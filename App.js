import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Switch,
  ImageBackground,
  Modal
} from "react-native";
import * as Location from "expo-location";
import { Magnetometer } from "expo-sensors";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapView, { Marker, Polyline } from "react-native-maps";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";

const LIME = "#C6FF35";
const BG = "#091016";
const CARD = "#121A23";
const MUTED = "#738496";
const BORDER = "#1E2A38";
const HISTORY_KEY = "@raftaar_run_history_v2";
const MUSIC_KEY = "@raftaar_music_v2";

const mapDarkStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#263c3f" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
  { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
];

const haversine = (a, b) => {
  const r = n => n * Math.PI / 180;
  const dLat = r(b.latitude - a.latitude);
  const dLon = r(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const timeText = n => {
  n = Math.max(0, Math.floor(n || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  return h ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const paceText = (seconds, km) => {
  if (!km || km < 0.01) return "--:--";
  const p = Math.floor(seconds / km);
  return `${String(Math.floor(p / 60)).padStart(2, "0")}:${String(p % 60).padStart(2, "0")}`;
};

function Action({ icon, label, color = "#B0BEC5", onPress, disabled }) {
  return (
    <TouchableOpacity style={[s.action, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled} activeOpacity={0.75}>
      <Ionicons name={icon} size={18} color={color} style={{ marginBottom: 2 }} />
      <Text style={s.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Metric({ icon, label, value, unit, note, iconBg, iconColor, dotColor }) {
  return (
    <View style={s.metric}>
      <View style={s.metricHead}>
        <View style={[s.metricIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={14} color={iconColor} style={icon === 'navigate' ? { transform: [{ rotate: '45deg' }] } : {}} />
        </View>
        <Text style={s.metricLabel}>{label}</Text>
      </View>
      <View style={s.metricValueRow}>
        <Text style={s.metricValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        {!!unit && <Text style={s.metricUnit}>{unit}</Text>}
      </View>
      <View style={s.metricNoteRow}>
        <View style={[s.metricDot, { backgroundColor: dotColor }]} />
        <Text style={s.metricNote} numberOfLines={1}>{note}</Text>
      </View>
    </View>
  );
}

function Compass() {
  const [heading, setHeading] = useState(null);
  useEffect(() => {
    let sub;
    let mounted = true;
    Magnetometer.isAvailableAsync().then(ok => {
      if (!mounted || !ok) return;
      Magnetometer.setUpdateInterval(150);
      sub = Magnetometer.addListener(({ x, y }) => {
        const degrees = ((Math.atan2(y, x) * 180) / Math.PI + 360 + 270) % 360;
        setHeading(Math.round(degrees));
      });
    }).catch(() => {});
    return () => { mounted = false; sub?.remove(); };
  }, []);

  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const direction = heading == null ? "NO GPS" : dirs[Math.round(heading / 45) % 8];

  return (
    <View style={s.compassBox}>
      <View style={s.compassIconBg}>
        <Ionicons name="compass" size={20} color="#FFF" style={{ transform: [{ rotate: `${heading ?? 0}deg` }] }} />
      </View>
      {heading != null && <Text style={s.compassDeg}>{heading}° {direction}</Text>}
    </View>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("Run");
  const [voiceCommand, setVoiceCommand] = useState(true);
  
  const [status, setStatus] = useState("ready");
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [accuracy, setAccuracy] = useState(null);
  const [gpsMessage, setGpsMessage] = useState("Waiting for GPS");
  const [route, setRoute] = useState([]);
  const [history, setHistory] = useState([]);
  const [locked, setLocked] = useState(false);
  const [files, setFiles] = useState([]);
  const [musicIndex, setMusicIndex] = useState(-1);
  const [sound, setSound] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [region, setRegion] = useState(null);
  const [mapType, setMapType] = useState("standard");
  
  const [selectedRun, setSelectedRun] = useState(null);
  const [ghostRun, setGhostRun] = useState(null);
  const [ghostDistance, setGhostDistance] = useState(0);
  const [replayIdx, setReplayIdx] = useState(-1);
  const [showGhostResult, setShowGhostResult] = useState(false);
  const [ghostStats, setGhostStats] = useState(null);

  const watch = useRef(null);
  const lastPoint = useRef(null);
  const startAt = useRef(null);
  const elapsedBase = useRef(0);
  const elapsedRef = useRef(0);
  const distanceRef = useRef(0);
  const routeRef = useRef([]);
  const statusRef = useRef("ready");
  const soundRef = useRef(null);
  const topSpeedRef = useRef(0);
useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(console.warn);
  }, []);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);
  useEffect(() => { distanceRef.current = distance; }, [distance]);
  useEffect(() => { routeRef.current = route; }, [route]);

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then(raw => { if (raw) setHistory(JSON.parse(raw)); }).catch(() => {});
    AsyncStorage.getItem(MUSIC_KEY).then(raw => { 
      if (raw) {
        const parsed = JSON.parse(raw);
        setFiles(parsed);
        if (parsed.length > 0 && musicIndex < 0) setMusicIndex(0);
      } 
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (status !== "running") return;
    const timer = setInterval(() => {
      if (startAt.current != null) {
        const currentElapsed = elapsedBase.current + Math.floor((Date.now() - startAt.current) / 1000);
        setElapsed(currentElapsed);

        if (ghostRun && ghostRun.route && ghostRun.route.length > 0) {
          let gDist = 0;
          const firstTime = ghostRun.route[0].timestamp;
          for (let i = 1; i < ghostRun.route.length; i++) {
             const dt = (ghostRun.route[i].timestamp - firstTime) / 1000;
             if (dt <= currentElapsed) {
                 gDist += haversine(ghostRun.route[i-1], ghostRun.route[i]) / 1000;
             } else break;
          }
          setGhostDistance(gDist);
        }
      }
    }, 500);
    return () => clearInterval(timer);
  }, [status, ghostRun]);

  const speak = (message) => {
    if (voiceCommand) {
      try { Speech.stop(); Speech.speak(message); } catch (e) {}
    }
  };

  const handleVoiceToggle = (val) => {
    setVoiceCommand(val);
    if (val) {
      Speech.speak("Voice command activated");
    } else {
      Speech.speak("Voice command deactivated");
    }
  };

  const stopWatch = useCallback(async () => {
    if (watch.current) { watch.current.remove(); watch.current = null; }
  }, []);

  const onLocation = useCallback(location => {
    const c = location.coords;
    const point = { latitude: c.latitude, longitude: c.longitude, timestamp: location.timestamp || Date.now(), accuracy: c.accuracy ?? null };
    setAccuracy(c.accuracy ?? null);
    setRegion({ latitude: c.latitude, longitude: c.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 });

    if (c.accuracy != null && c.accuracy > 50) { setGpsMessage("Weak GPS"); return; }
    setGpsMessage(c.accuracy == null ? "GPS connected" : c.accuracy <= 15 ? "GPS excellent" : "GPS connected");

    if (statusRef.current !== "running") return;
    const previous = lastPoint.current;
    if (!previous) {
      lastPoint.current = point;
      setRoute(old => { const next = [...old, point]; routeRef.current = next; return next; });
      return;
    }
    const meters = haversine(previous, point);
    const dt = Math.max(0.1, (point.timestamp - previous.timestamp) / 1000);
    if (meters < 2) return;
    if (meters / dt > 8) { lastPoint.current = point; return; }

    lastPoint.current = point;
    const currentSpeed = (meters / dt) * 3.6;
    setSpeed(currentSpeed);
    if (currentSpeed > topSpeedRef.current) topSpeedRef.current = currentSpeed;
    
    setDistance(old => { const next = old + meters / 1000; distanceRef.current = next; return next; });
    setRoute(old => { if (old.length >= 6000) return old; const next = [...old, point]; routeRef.current = next; return next; });
  }, []);

  const startWatch = useCallback(async () => {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) { Alert.alert("GPS off", "Turn on GPS."); return false; }
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") { Alert.alert("Permission required", "Allow location access."); return false; }
    await stopWatch();
    try {
      const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setAccuracy(first.coords.accuracy ?? null);
      setRegion({ latitude: first.coords.latitude, longitude: first.coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 });
    } catch (_) {}
    watch.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 2 }, onLocation);
    return true;
  }, [onLocation, stopWatch]);

  const startRun = async () => {
    if (busy) return;
    setBusy(true);
    try {
      setStatus("running"); statusRef.current = "running";
      const ok = await startWatch();
      if (!ok) { setStatus("ready"); statusRef.current = "ready"; return; }
      elapsedBase.current = 0; elapsedRef.current = 0; startAt.current = Date.now(); distanceRef.current = 0; routeRef.current = []; topSpeedRef.current = 0;
      setElapsed(0); setDistance(0); setSpeed(0); setRoute([]); setGpsMessage("Searching GPS");
      speak(ghostRun ? "Ghost race started" : "Run started");
    } catch (e) { setStatus("ready"); Alert.alert("Error", e?.message); } finally { setBusy(false); }
  };

  const pauseRun = async () => {
    if (status !== "running") return;
    elapsedBase.current = elapsedRef.current; startAt.current = null;
    setStatus("paused"); statusRef.current = "paused"; setSpeed(0); await stopWatch();
    speak("Run paused");
  };

  const resumeRun = async () => {
    if (busy) return;
    setBusy(true);
    try {
      setStatus("running"); statusRef.current = "running";
      const ok = await startWatch();
      if (!ok) { setStatus("paused"); statusRef.current = "paused"; return; }
      lastPoint.current = null; startAt.current = Date.now();
      speak("Run resumed");
    } catch (e) { setStatus("paused"); Alert.alert("Error", e?.message); } finally { setBusy(false); }
  };

  const resetRun = async () => {
    await stopWatch();
    setStatus("ready"); statusRef.current = "ready";
    setElapsed(0); setDistance(0); setSpeed(0); setAccuracy(null); setGpsMessage("Waiting for GPS"); setRoute([]); setGhostRun(null); setGhostDistance(0);
    elapsedBase.current = 0; elapsedRef.current = 0; distanceRef.current = 0; routeRef.current = []; startAt.current = null; lastPoint.current = null; topSpeedRef.current = 0;
  };

  const finishRun = async () => {
    if (status === "ready") { resetRun(); return; }
    speak("Workout stopped");
    await stopWatch();
    
    const avgSpd = elapsedRef.current > 0 ? (distanceRef.current / (elapsedRef.current / 3600)) : 0;
    const finalDist = distanceRef.current;
    const finalDur = elapsedRef.current;

    const saved = { 
      id: String(Date.now()), 
      date: new Date().toISOString(), 
      duration: finalDur, 
      distance: finalDist, 
      pace: paceText(finalDur, finalDist), 
      calories: Math.round(finalDist * 60), 
      route: routeRef.current,
      topSpeed: topSpeedRef.current.toFixed(1),
      avgSpeed: avgSpd.toFixed(1)
    };

    if (saved.duration > 0 || saved.distance > 0) {
      const next = [saved, ...history].slice(0, 100);
      setHistory(next);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => {});
      
      if (ghostRun) {
         setGhostStats({
           current: saved,
           ghost: ghostRun
         });
         setShowGhostResult(true);
         const diff = finalDist - ghostRun.distance;
         if (diff >= 0) speak("You beat your ghost! Excellent job.");
         else speak("Workout finished. Keep practicing to beat your ghost.");
      } else {
         speak("Workout saved successfully");
      }
    }
    
    await resetRun(); 
    if(!ghostRun) setTab("History");
  };

  const chooseMusic = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return;
      const chosen = result.assets || [];
      if (!chosen.length) return;
      setFiles(old => {
        const seen = new Set(old.map(f => f.uri));
        const updated = [...old, ...chosen.filter(f => !seen.has(f.uri))];
        AsyncStorage.setItem(MUSIC_KEY, JSON.stringify(updated)).catch(()=>{});
        return updated;
      });
      if (musicIndex < 0) setMusicIndex(0);
    } catch (e) { Alert.alert("Error", e?.message); }
  };

  const removeMusic = (index) => {
    Alert.alert("Remove Track?", "Are you sure you want to remove this song?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
          if (index === musicIndex && soundRef.current) {
            await soundRef.current.unloadAsync();
            soundRef.current = null;
            setPlaying(false);
            setMusicIndex(-1);
          }
          setFiles(old => {
            const updated = old.filter((_, i) => i !== index);
            AsyncStorage.setItem(MUSIC_KEY, JSON.stringify(updated)).catch(()=>{});
            return updated;
          });
      }}
    ]);
  };

  const playMusicAt = async (index) => {
    if (!files.length) return;
    const i = (index + files.length) % files.length;
    const item = files[i];
    if (!item?.uri) return;

    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: item.uri },
        { shouldPlay: true }
      );
      soundRef.current = newSound;
      setSound(newSound);
      setMusicIndex(i);
      setPlaying(true);
      
      newSound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish) {
          playMusicAt(i + 1); // Auto play next
        }
      });
    } catch (e) {
      console.log(e);
      Alert.alert("Playback error", "Could not play this audio file. It might be corrupted or unsupported.");
    }
  };

  const toggleMusic = async () => {
    if (!files.length) { chooseMusic(); return; }
    if (!soundRef.current) { 
        playMusicAt(musicIndex < 0 ? 0 : musicIndex);
        return; 
    }
    try {
      const st = await soundRef.current.getStatusAsync();
      if (st.isLoaded && st.isPlaying) { await soundRef.current.pauseAsync(); setPlaying(false); } 
      else if (st.isLoaded) { await soundRef.current.playAsync(); setPlaying(true); }
    } catch (_) { setPlaying(false); }
  };

  const deleteHistory = id => {
    Alert.alert("Delete?", "Remove session?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          const next = history.filter(item => item.id !== id);
          setHistory(next);
          setSelectedRun(null);
          await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => {});
        }
      }
    ]);
  };

  const startRouteReplay = () => {
    if(!selectedRun || !selectedRun.route || selectedRun.route.length === 0) return;
    setReplayIdx(0);
    let i = 0;
    const interval = setInterval(() => {
       i += Math.ceil(selectedRun.route.length / 50); 
       if (i >= selectedRun.route.length) {
           i = selectedRun.route.length - 1;
           clearInterval(interval);
           setTimeout(() => setReplayIdx(-1), 2000);
       }
       setReplayIdx(i);
    }, 100);
  };

  const liveSpeed = speed > 0.3 ? speed.toFixed(1) : "0.0";
  const livePace = speed > 0.3 ? paceText(3600, speed) : "--:--";
  const maxGraphDist = Math.max(...history.slice(0, 7).map(h => h.distance), 1);

  const renderRun = () => (
    <View style={s.runContainer}>
      <View style={s.brandRow}>
        <View style={s.brandLeft}>
          <View style={s.brandIcon}><Ionicons name="flash" size={20} color={LIME} /></View>
          <View style={s.brandText}>
            <Text style={s.brandTitle}>Raftaar</Text>
            <Text style={s.brandSubtitle}>Run, Your Way.</Text>
          </View>
        </View>
        
        <View style={s.voiceCommandRow}>
          <Text style={s.voiceText}>Voice Command</Text>
          <Switch 
            value={voiceCommand} 
            onValueChange={handleVoiceToggle} 
            trackColor={{ false: "#2A3644", true: LIME }} 
            thumbColor="#FFFFFF" 
            style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
          />
        </View>
      </View>

      <View style={s.heroContainer}>
        <ImageBackground source={{ uri: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?q=80&w=800&auto=format&fit=crop" }} style={s.hero} imageStyle={s.heroImage} resizeMode="cover">
          <View style={s.heroOverlay} />
          
          <View style={s.heroTop}>
            <View style={s.gpsBadge}>
              <Ionicons name="cellular" size={12} color={LIME} />
              <Text style={s.gpsMain}>{accuracy == null ? "GPS" : `± ${Math.round(accuracy)} m`}</Text>
            </View>
            <Compass />
          </View>

          <View style={s.heroCenter}>
            <View style={s.statusPill}>
              <View style={[s.statusDot, { backgroundColor: status === "running" ? LIME : status === "paused" ? "#FFC52F" : "#8A9AA8" }]} />
              <Text style={s.statusText}>{status === "running" ? "RUNNING" : status === "paused" ? "PAUSED" : "READY"}</Text>
            </View>
            <Text style={s.timer}>{timeText(elapsed)}</Text>
            <Text style={s.elapsedLabel}>ELAPSED TIME</Text>
          </View>

          <View style={s.controlsContainer}>
             {!locked ? (
               <View style={s.controls}>
                 <Action icon="square" label="STOP" onPress={finishRun} disabled={busy} />
                 <TouchableOpacity style={s.mainButton} disabled={busy} activeOpacity={0.8} onPress={status === "running" ? pauseRun : status === "paused" ? resumeRun : startRun}>
                   <Ionicons name={status === "running" ? "pause" : "play"} size={28} color="#000" style={status !== "running" ? { marginLeft: 4 } : {}} />
                 </TouchableOpacity>
                 <Action icon="lock-closed-outline" label="LOCK" onPress={() => setLocked(true)} />
               </View>
             ) : (
               <View style={s.lockedOverlayControls}>
                 <View style={s.lockCard}>
                   <Ionicons name="lock-closed" size={24} color={LIME} />
                   <Text style={s.lockTitle}>SCREEN LOCKED</Text>
                   <TouchableOpacity style={s.unlockButton} onPress={() => setLocked(false)} activeOpacity={0.8}>
                     <Ionicons name="lock-open" size={14} color="#000" />
                     <Text style={s.unlockText}>UNLOCK SCREEN</Text>
                   </TouchableOpacity>
                 </View>
               </View>
             )}
          </View>
        </ImageBackground>
      </View>

      {ghostRun && (
         <View style={s.ghostBanner}>
             <View style={{flexDirection:'row', alignItems:'center', gap: 6}}>
                 <Ionicons name="ghost" size={16} color={LIME} />
                 <Text style={{color:'#FFF', fontSize: 11, fontWeight:'700'}}>GHOST RACE</Text>
             </View>
             <Text style={{color: distance >= ghostDistance ? LIME : '#FF4444', fontWeight:'800'}}>
                 {distance >= ghostDistance ? "Ahead by " : "Behind by "} 
                 {Math.abs(distance - ghostDistance).toFixed(2)} km
             </Text>
         </View>
      )}

      <View style={s.grid} pointerEvents={locked ? "none" : "auto"}>
        <Metric icon="navigate" label="DISTANCE" value={distance.toFixed(2)} unit="km" note={gpsMessage} iconBg={LIME} iconColor="#000" dotColor={LIME} />
        <Metric icon="flash" label="LIVE PACE" value={livePace} unit="/km" note="Calculating..." iconBg="#3B82F6" iconColor="#FFF" dotColor="#3B82F6" />
        <Metric icon="flash" label="LIVE SPEED" value={liveSpeed} unit="km/h" note="Live GPS" iconBg="#8B5CF6" iconColor="#FFF" dotColor="#3B82F6" />
        <Metric icon="flame" label="CALORIES" value={String(Math.round(distance * 60))} unit="kcal" note="Burning energy" iconBg="#EF4444" iconColor="#FFF" dotColor="#EF4444" />
      </View>

      <TouchableOpacity style={s.musicMini} onPress={files.length === 0 ? chooseMusic : undefined} disabled={locked}>
        <View style={s.musicMiniLeft}>
           <Ionicons name="musical-note" size={14} color={MUTED} />
           <Text numberOfLines={1} style={s.musicMiniTitle}>{files[musicIndex]?.name || "Choose music to play..."}</Text>
        </View>
        <View style={s.musicControls} pointerEvents={locked ? "none" : "auto"}>
          <TouchableOpacity style={s.miniControl} onPress={() => playMusicAt(musicIndex - 1)}>
            <Ionicons name="play-skip-back" size={16} color="#DCE6EF" />
          </TouchableOpacity>
          <TouchableOpacity style={s.miniPlay} onPress={toggleMusic}>
            <Ionicons name={playing ? "pause" : "play"} size={16} color="#000" style={!playing ? { marginLeft: 2 } : {}} />
          </TouchableOpacity>
          <TouchableOpacity style={s.miniControl} onPress={() => playMusicAt(musicIndex + 1)}>
            <Ionicons name="play-skip-forward" size={16} color="#DCE6EF" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );

  if (selectedRun) {
    return (
      <SafeAreaView style={s.safe}>
         <View style={s.detailsHeader}>
            <TouchableOpacity onPress={() => { setSelectedRun(null); setReplayIdx(-1); }} style={s.backBtn}>
               <Ionicons name="chevron-back" size={24} color="#FFF" />
               <Text style={{color:'#FFF', fontSize: 16, fontWeight:'600'}}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteHistory(selectedRun.id)}>
               <Ionicons name="trash-outline" size={22} color="#FF4444" />
            </TouchableOpacity>
         </View>
         
         <View style={s.detailsMapWrapper}>
           {selectedRun.route && selectedRun.route.length > 0 ? (
             <MapView style={StyleSheet.absoluteFill} customMapStyle={mapDarkStyle} initialRegion={{ latitude: selectedRun.route[0].latitude, longitude: selectedRun.route[0].longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }} scrollEnabled={false} pitchEnabled={false} rotateEnabled={false}>
                 <Polyline coordinates={replayIdx >= 0 ? selectedRun.route.slice(0, replayIdx) : selectedRun.route} strokeColor={LIME} strokeWidth={5} />
                 {replayIdx >= 0 && selectedRun.route[replayIdx] && (
                     <Marker coordinate={selectedRun.route[replayIdx]}>
                        <View style={{width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFF', borderWidth: 3, borderColor: LIME}}/>
                     </Marker>
                 )}
             </MapView>
           ) : (
             <View style={{flex:1, alignItems:'center', justifyContent:'center'}}><Text style={{color:MUTED}}>No Route Data</Text></View>
           )}
           <TouchableOpacity style={s.replayBtn} onPress={startRouteReplay}>
              <Ionicons name="play" size={16} color="#000" />
              <Text style={{color:'#000', fontWeight:'800', fontSize:11}}>REPLAY ROUTE</Text>
           </TouchableOpacity>
         </View>

         <ScrollView style={{flex:1}} contentContainerStyle={{padding: 16}}>
            <Text style={{color:MUTED, fontSize: 12, marginBottom: 15}}>{new Date(selectedRun.date).toLocaleString()}</Text>
            <View style={s.detailsGrid}>
               <View style={s.dCard}><Text style={s.dLabel}>DISTANCE</Text><Text style={s.dValue}>{selectedRun.distance?.toFixed(2)} km</Text></View>
               <View style={s.dCard}><Text style={s.dLabel}>DURATION</Text><Text style={s.dValue}>{timeText(selectedRun.duration)}</Text></View>
               <View style={s.dCard}><Text style={s.dLabel}>AVG PACE</Text><Text style={s.dValue}>{selectedRun.pace} /km</Text></View>
               <View style={s.dCard}><Text style={s.dLabel}>CALORIES</Text><Text style={s.dValue}>{selectedRun.calories} kcal</Text></View>
               <View style={s.dCard}><Text style={s.dLabel}>TOP SPEED</Text><Text style={s.dValue}>{selectedRun.topSpeed || "0.0"} km/h</Text></View>
               <View style={s.dCard}><Text style={s.dLabel}>AVG SPEED</Text><Text style={s.dValue}>{selectedRun.avgSpeed || "0.0"} km/h</Text></View>
            </View>
            
            <TouchableOpacity style={s.ghostBtn} onPress={() => { setGhostRun(selectedRun); setSelectedRun(null); setTab("Run"); }}>
               <Ionicons name="ghost" size={20} color="#000" />
               <Text style={s.ghostBtnText}>RACE THIS GHOST</Text>
            </TouchableOpacity>
         </ScrollView>
      </SafeAreaView>
    );
  }

  const mapCategories = [
    { label: "Standard", value: "standard" },
    { label: "Satellite", value: "satellite" },
    { label: "Terrain", value: "terrain" },
    { label: "Hybrid", value: "hybrid" },
  ];

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <StatusBar hidden />
      <View style={s.root}>
        <View style={s.mainWrapper}>
          {tab === "Run" && renderRun()}
          
          {tab === "History" && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
               <Text style={s.pageTitle}>Run History</Text>
               
               {history.length > 0 && (
                 <View style={s.graphContainer}>
                   <Text style={{color: '#FFF', fontWeight: '800', fontSize: 13, marginBottom: 20}}>CONSISTENCY (Last 7 Runs)</Text>
                   <View style={s.graphBars}>
                      {history.slice(0, 7).reverse().map((h, i) => {
                         const ht = Math.max((h.distance / maxGraphDist) * 100, 5); 
                         return (
                           <View key={i} style={{alignItems:'center'}}>
                              <View style={s.barTrack}>
                                 <View style={[s.barFill, {height: `${ht}%`}]} />
                              </View>
                              <Text style={{color: MUTED, fontSize: 10, marginTop: 8, fontWeight: '600'}}>{h.distance.toFixed(1)}</Text>
                           </View>
                         )
                      })}
                   </View>
                 </View>
               )}

               {history.map(item => (
                 <TouchableOpacity key={item.id} style={s.premiumCard} onPress={() => setSelectedRun(item)} activeOpacity={0.8}>
                   <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between'}}>
                      <View>
                        <Text style={s.historyDate}>{new Date(item.date).toLocaleDateString()}</Text>
                        <View style={{flexDirection:'row', alignItems:'baseline', gap:4, marginTop: 4}}>
                           <Text style={s.historyValue}>{item.distance.toFixed(2)}</Text>
                           <Text style={{color: MUTED, fontSize: 12}}>km</Text>
                        </View>
                      </View>
                      <View style={{alignItems:'flex-end'}}>
                        <Text style={{color: '#FFF', fontWeight:'700', fontSize: 16}}>{timeText(item.duration)}</Text>
                        <Text style={{color: LIME, fontSize: 12, marginTop:4, fontWeight:'700'}}>{item.pace} /km</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={MUTED} />
                   </View>
                 </TouchableOpacity>
               ))}
               {history.length === 0 && <Text style={{color:MUTED, textAlign:'center', marginTop: 50}}>No runs saved yet.</Text>}
            </ScrollView>
          )}
          
          {tab === "Map" && (
             <View style={{flex: 1}}>
               <View style={s.mapCategorySelector}>
                 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                   {mapCategories.map(cat => (
                     <TouchableOpacity key={cat.value} style={[s.catBtn, mapType === cat.value && s.catBtnActive]} onPress={() => setMapType(cat.value)}>
                       <Text style={[s.catBtnText, mapType === cat.value && s.catBtnTextActive]}>{cat.label}</Text>
                     </TouchableOpacity>
                   ))}
                 </ScrollView>
               </View>
               <View style={{flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: BORDER}}>
                 {region ? (
                    <MapView mapType={mapType} customMapStyle={mapDarkStyle} style={StyleSheet.absoluteFill} initialRegion={region} region={region} showsUserLocation>
                        <Polyline coordinates={route} strokeColor={LIME} strokeWidth={4}/>
                    </MapView>
                 ) : ( <Text style={{color: MUTED, textAlign: 'center', marginTop: 50}}>Waiting for GPS...</Text> )}
               </View>
             </View>
          )}
          
          {tab === "Music" && (
             <View style={{flex: 1}}>
               <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 100}}>
                 <Text style={s.pageTitle}>Playlist</Text>
                 <TouchableOpacity style={s.addMusic} onPress={chooseMusic} activeOpacity={0.8}>
                     <Text style={{color: '#000', fontWeight: '800', letterSpacing: 0.5}}>ADD MUSIC FILES</Text>
                 </TouchableOpacity>
                 {files.map((file, i) => (
                    <View key={i} style={s.musicCard}>
                      <TouchableOpacity style={{flex: 1, paddingVertical: 18, paddingLeft: 18}} onPress={() => playMusicAt(i)}>
                        <Text style={{color: musicIndex === i ? LIME : '#FFF', fontWeight: musicIndex === i ? '700' : '500'}} numberOfLines={2}>
                          {file.name}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{padding: 18}} onPress={() => removeMusic(i)}>
                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                 ))}
                 {files.length === 0 && <Text style={{color:MUTED, textAlign:'center', marginTop: 40}}>Your playlist is empty.</Text>}
               </ScrollView>

               {/* Sticky Music Player overlay inside Music Tab */}
               {files.length > 0 && (
                  <View style={s.floatingPlayer}>
                    <View style={{flex: 1, paddingRight: 10}}>
                       <Ionicons name="musical-note" size={12} color={MUTED} />
                       <Text numberOfLines={1} style={{color:'#FFF', fontSize:12, fontWeight:'600', marginTop:2}}>
                         {files[musicIndex]?.name || "Select a track"}
                       </Text>
                    </View>
                    <View style={{flexDirection:'row', alignItems:'center', gap: 15}}>
                       <TouchableOpacity onPress={() => playMusicAt(musicIndex - 1)}>
                         <Ionicons name="play-skip-back" size={20} color="#FFF" />
                       </TouchableOpacity>
                       <TouchableOpacity style={s.floatingPlayBtn} onPress={toggleMusic}>
                         <Ionicons name={playing ? "pause" : "play"} size={20} color="#000" style={!playing ? {marginLeft: 2} : {}} />
                       </TouchableOpacity>
                       <TouchableOpacity onPress={() => playMusicAt(musicIndex + 1)}>
                         <Ionicons name="play-skip-forward" size={20} color="#FFF" />
                       </TouchableOpacity>
                    </View>
                  </View>
               )}
             </View>
          )}
        </View>

        <View style={[s.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents={locked ? "none" : "auto"}>
          {[{ name: "Run", icon: "flash" }, { name: "Music", icon: "musical-notes-outline" }, { name: "Map", icon: "map-outline" }, { name: "History", icon: "time-outline" }].map(item => {
            const active = tab === item.name;
            return (
              <TouchableOpacity key={item.name} style={s.navItem} onPress={() => setTab(item.name)} activeOpacity={0.75}>
                <Ionicons name={item.icon} size={22} color={active ? LIME : "#6B7C8C"} />
                <Text style={[s.navLabel, active && s.navActive]}>{item.name}</Text>
                {active && <View style={s.navIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Premium Ghost Race Result Modal */}
        <Modal visible={showGhostResult} transparent animationType="fade">
           <View style={s.ghostResultOverlay}>
              <View style={s.ghostResultCard}>
                 <View style={{width: 50, height: 50, borderRadius: 25, backgroundColor: LIME, alignItems:'center', justifyContent:'center', marginBottom: 15}}>
                    <Ionicons name={ghostStats?.current.distance >= ghostStats?.ghost.distance ? "trophy" : "trending-up"} size={26} color="#000" />
                 </View>
                 <Text style={{color:'#FFF', fontSize: 22, fontWeight:'900', marginBottom: 8}}>
                    {ghostStats?.current.distance >= ghostStats?.ghost.distance ? "AWESOME WORK!" : "NICE TRY!"}
                 </Text>
                 <Text style={{color:MUTED, fontSize: 12, textAlign:'center', marginBottom: 25}}>
                    {ghostStats?.current.distance >= ghostStats?.ghost.distance 
                       ? `You beat your ghost by ${(ghostStats?.current.distance - ghostStats?.ghost.distance).toFixed(2)} km.` 
                       : `You were behind by ${Math.abs(ghostStats?.current.distance - ghostStats?.ghost.distance).toFixed(2)} km.`}
                 </Text>

                 <View style={{width:'100%', gap: 15, marginBottom: 25}}>
                    <View style={s.ghostStatRow}>
                       <Text style={{color: MUTED, fontSize: 12, width: '30%'}}>Time</Text>
                       <Text style={{color: '#FFF', fontSize: 14, fontWeight:'700', width: '35%', textAlign:'center'}}>{timeText(ghostStats?.current.duration)}</Text>
                       <Text style={{color: MUTED, fontSize: 12, width: '35%', textAlign:'right'}}>{timeText(ghostStats?.ghost.duration)}</Text>
                    </View>
                    <View style={s.ghostStatRow}>
                       <Text style={{color: MUTED, fontSize: 12, width: '30%'}}>Distance</Text>
                       <Text style={{color: LIME, fontSize: 14, fontWeight:'700', width: '35%', textAlign:'center'}}>{ghostStats?.current.distance.toFixed(2)} km</Text>
                       <Text style={{color: MUTED, fontSize: 12, width: '35%', textAlign:'right'}}>{ghostStats?.ghost.distance.toFixed(2)} km</Text>
                    </View>
                    <View style={s.ghostStatRow}>
                       <Text style={{color: MUTED, fontSize: 12, width: '30%'}}>Speed</Text>
                       <Text style={{color: '#FFF', fontSize: 14, fontWeight:'700', width: '35%', textAlign:'center'}}>{ghostStats?.current.avgSpeed} km/h</Text>
                       <Text style={{color: MUTED, fontSize: 12, width: '35%', textAlign:'right'}}>{ghostStats?.ghost.avgSpeed} km/h</Text>
                    </View>
                 </View>

                 <TouchableOpacity style={s.ghostCloseBtn} onPress={() => { setShowGhostResult(false); setTab("History"); }}>
                    <Text style={{color:'#000', fontWeight:'800', fontSize: 14}}>DONE</Text>
                 </TouchableOpacity>
              </View>
           </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

export default function App() { return <SafeAreaProvider><AppContent /></SafeAreaProvider>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  root: { flex: 1, backgroundColor: BG, justifyContent: "space-between" },
  mainWrapper: { flex: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 5, justifyContent: "space-between" },
  runContainer: { flex: 1, justifyContent: "space-between" },
  scrollContent: { paddingBottom: 20 },

  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 },
  brandLeft: { flexDirection: "row", alignItems: "center" },
  brandIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#152014", borderWidth: 1, borderColor: "#304221", alignItems: "center", justifyContent: "center" },
  brandText: { marginLeft: 10 },
  brandTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  brandSubtitle: { color: MUTED, fontSize: 11 },
  
  voiceCommandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  voiceText: { color: MUTED, fontSize: 11, fontWeight: "600" },

  heroContainer: { flex: 1, maxHeight: 270, marginBottom: 10, borderRadius: 28, overflow: "hidden", elevation: 5, backgroundColor: "#111" },
  hero: { flex: 1, padding: 16, justifyContent: "space-between" },
  heroImage: { borderRadius: 28, opacity: 0.6 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 15, 25, 0.4)' },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", zIndex: 2 },
  gpsBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  gpsMain: { color: "#FFFFFF", fontWeight: "700", fontSize: 11 },
  compassBox: { alignItems: "center", justifyContent: "center" },
  compassIconBg: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  compassDeg: { color: LIME, fontSize: 9, fontWeight: "800", marginTop: 4 },
  
  heroCenter: { alignItems: "center", justifyContent: "center", zIndex: 2, marginTop: -15 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LIME },
  statusText: { color: "#FFFFFF", fontWeight: "800", letterSpacing: 2, fontSize: 10 },
  timer: { color: "#FFFFFF", fontSize: 56, fontWeight: "900", letterSpacing: -2, fontVariant: ["tabular-nums"], lineHeight: 65 },
  elapsedLabel: { color: "#92A5B8", fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  
  controlsContainer: { height: 75, justifyContent: "center" },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", zIndex: 2 },
  action: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  actionLabel: { color: "#9EAAB6", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  mainButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#FFC52F", alignItems: "center", justifyContent: "center", shadowColor: "#FFC52F", shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },

  lockedOverlayControls: { flexDirection: "row", justifyContent: "center", alignItems: "center", zIndex: 10 },
  lockCard: { flexDirection: "row", backgroundColor: "#111820", borderWidth: 1.5, borderColor: LIME, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 20, alignItems: "center", gap: 12, shadowColor: LIME, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 15, elevation: 10 },
  lockTitle: { color: "#FFF", fontWeight: "800", letterSpacing: 1, fontSize: 12 },
  unlockButton: { backgroundColor: LIME, flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  unlockText: { color: "#000", fontWeight: "900", fontSize: 10 },

  ghostBanner: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 10 },
  
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10, marginBottom: 12 },
  metric: { width: "48%", borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 12, justifyContent: "space-between", minHeight: 90 },
  metricHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  metricIcon: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  metricLabel: { color: "#90A0B0", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  metricValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 8 },
  metricValue: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  metricUnit: { color: "#90A0B0", fontSize: 11, fontWeight: "600" },
  metricNoteRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  metricDot: { width: 5, height: 5, borderRadius: 2.5 },
  metricNote: { color: MUTED, fontSize: 9, fontWeight: "500" },

  musicMini: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, gap: 10, justifyContent: 'space-between', marginBottom: 5 },
  musicMiniLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  musicMiniTitle: { color: "#D1DDE8", fontSize: 12, fontWeight: "600", flexShrink: 1 },
  musicControls: { flexDirection: "row", alignItems: "center", gap: 12 },
  miniPlay: { width: 32, height: 32, borderRadius: 16, backgroundColor: LIME, alignItems: "center", justifyContent: "center" },

  bottomNav: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "#091016", borderTopWidth: 1, borderTopColor: "#1E2A38", paddingTop: 8, paddingHorizontal: 4 },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  navLabel: { color: "#6B7C8C", fontSize: 10, fontWeight: "700" },
  navActive: { color: LIME },
  navIndicator: { position: "absolute", bottom: -8, width: 20, height: 3, borderRadius: 1.5, backgroundColor: LIME },

  mapCategorySelector: { flexDirection: 'row', marginBottom: 12 },
  catBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER },
  catBtnActive: { backgroundColor: LIME, borderColor: LIME },
  catBtnText: { color: MUTED, fontSize: 12, fontWeight: '700' },
  catBtnTextActive: { color: '#000', fontWeight: '800' },

  pageTitle: { color: "#FFF", fontSize: 26, fontWeight: "800", marginBottom: 15, marginTop: 10, letterSpacing: -0.5 },
  premiumCard: { backgroundColor: CARD, padding: 18, borderRadius: 22, borderWidth: 1, borderColor: BORDER, marginBottom: 12, shadowColor: "#000", shadowOffset:{width:0, height:4}, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  historyDate: { color: MUTED, fontSize: 11, fontWeight: '600' },
  historyValue: { color: "#FFF", fontSize: 26, fontWeight: "800", letterSpacing: -1 },
  
  musicCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: BORDER, marginBottom: 12, shadowColor: "#000", shadowOffset:{width:0, height:4}, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  floatingPlayer: { position: 'absolute', bottom: 10, left: 10, right: 10, backgroundColor: '#1A2633', borderRadius: 24, paddingVertical: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 10, borderWidth: 1, borderColor: BORDER },
  floatingPlayBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' },

  graphContainer: { backgroundColor: CARD, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: BORDER, marginBottom: 20, shadowColor: "#000", shadowOffset:{width:0, height:4}, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  graphBars: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-end', height: 90 },
  barTrack: { width: 14, height: 80, backgroundColor: "#1A2633", borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: LIME, borderRadius: 7 },

  detailsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems:'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: BG },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  detailsMapWrapper: { height: 260, margin: 16, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: BORDER, backgroundColor: CARD },
  replayBtn: { position:'absolute', bottom: 15, right: 15, backgroundColor: LIME, flexDirection: 'row', alignItems:'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, elevation: 5 },
  
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 25 },
  dCard: { width: '48%', backgroundColor: CARD, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: BORDER },
  dLabel: { color: MUTED, fontSize: 10, fontWeight: '700', marginBottom: 6 },
  dValue: { color: '#FFF', fontSize: 20, fontWeight: '800' },

  ghostBtn: { backgroundColor: LIME, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 20, elevation: 5, marginBottom: 30 },
  ghostBtnText: { color: '#000', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },

  addMusic: { backgroundColor: LIME, paddingVertical: 18, borderRadius: 20, alignItems: 'center', marginBottom: 20, elevation: 4 },

  ghostResultOverlay: { flex: 1, backgroundColor: 'rgba(5, 12, 18, 0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  ghostResultCard: { width: '100%', backgroundColor: CARD, borderRadius: 28, padding: 25, alignItems: 'center', borderWidth: 1, borderColor: BORDER, shadowColor: LIME, shadowOffset: {width:0, height:10}, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 },
  ghostStatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A2633', padding: 12, borderRadius: 12 },
  ghostCloseBtn: { width: '100%', backgroundColor: LIME, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }
});
