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
  Modal,
  Image,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform
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
import * as Sharing from 'expo-sharing';
import { Camera, CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import ViewShot, { captureRef } from 'react-native-view-shot';
import Svg, { Polyline as SvgPolyline } from 'react-native-svg';

const LIME = "#C6FF35";
const BG = "#091016";
const CARD = "#121A23";
const MUTED = "#738496";
const BORDER = "#1E2A38";
const HISTORY_KEY = "@raftaar_run_history_v2";
const MUSIC_KEY = "@raftaar_music_v2";
const BMI_KEY = "@raftaar_bmi_profile";

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

const formatAudioTime = (millis) => {
  if (!millis) return "0:00";
  const totalSeconds = Math.floor(millis / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const getSvgPoints = (route, width, height) => {
  if (!route || route.length < 2) return "";
  const lats = route.map(p => p.latitude);
  const lons = route.map(p => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const latDiff = maxLat - minLat || 0.0001;
  const lonDiff = maxLon - minLon || 0.0001;
  const pad = 15; 

  return route.map(p => {
      const x = pad + ((p.longitude - minLon) / lonDiff) * (width - 2*pad);
      const y = pad + ((maxLat - p.latitude) / latDiff) * (height - 2*pad);
      return `${x},${y}`;
  }).join(' ');
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
  const [playing, setPlaying] = useState(false);
  
  const [songPosition, setSongPosition] = useState(0);
  const [songDuration, setSongDuration] = useState(1);

  const [busy, setBusy] = useState(false);
  const [region, setRegion] = useState(null);
  const [mapType, setMapType] = useState("standard");
  
  const [selectedRun, setSelectedRun] = useState(null);
  const [ghostRun, setGhostRun] = useState(null);
  const [ghostDistance, setGhostDistance] = useState(0);
  const [ghostDrawnRoute, setGhostDrawnRoute] = useState([]);
  const [replayIdx, setReplayIdx] = useState(-1);
  const [showGhostResult, setShowGhostResult] = useState(false);
  const [ghostStats, setGhostStats] = useState(null);

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareBgImage, setShareBgImage] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showRouteMap, setShowRouteMap] = useState(true);
  const [showVignette, setShowVignette] = useState(true);

  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showBmiModal, setShowBmiModal] = useState(false);
  const [bmiData, setBmiData] = useState({ height: '', weight: '', gender: 'Male' });
  const [savedBmi, setSavedBmi] = useState(null);

  const viewShotRef = useRef(null);
  const cameraRef = useRef(null);

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
  const lastMilestoneRef = useRef(0);
  const audioWidthRef = useRef(0); 

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsMessage("Permission denied");
        return;
      }
      try {
        let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
        setAccuracy(location.coords.accuracy);
        setGpsMessage("GPS connected");
      } catch (error) {
        setGpsMessage("Searching GPS...");
      }
    })();
  }, []);

  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      shouldDuckAndroid: false, 
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
    AsyncStorage.getItem(BMI_KEY).then(raw => {
      if (raw) {
        const parsed = JSON.parse(raw);
        setSavedBmi(parsed);
        setBmiData({ height: parsed.height, weight: parsed.weight, gender: parsed.gender });
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
          let currentGhostPath = [];
          for (let i = 0; i < ghostRun.route.length; i++) {
             const dt = (ghostRun.route[i].timestamp - firstTime) / 1000;
             if (dt <= currentElapsed) {
                 currentGhostPath.push(ghostRun.route[i]);
                 if (i > 0) {
                     gDist += haversine(ghostRun.route[i-1], ghostRun.route[i]) / 1000;
                 }
             } else break;
          }
          setGhostDistance(gDist);
          setGhostDrawnRoute(currentGhostPath);
        }
      }
    }, 500);
    return () => clearInterval(timer);
  }, [status, ghostRun]);

  const speak = (message) => {
    if (voiceCommand) {
      try { 
        Speech.stop(); 
        Speech.speak(message, { 
            rate: 1.0, 
            language: 'en-US' 
        }); 
      } catch (e) {}
    }
  };

  const handleVoiceToggle = (val) => {
    setVoiceCommand(val);
    if (val) speak("Voice systems activated.");
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
    setGpsMessage(c.accuracy == null ? "GPS signal locked." : c.accuracy <= 15 ? "GPS signal optimal." : "GPS signal locked.");

    if (statusRef.current !== "running") return;

    if (c.accuracy != null && c.accuracy > 25) return;

    const previous = lastPoint.current;
    if (!previous) {
      lastPoint.current = point;
      setRoute(old => { const next = [...old, point]; routeRef.current = next; return next; });
      return;
    }
    
    const meters = haversine(previous, point);
    const dt = Math.max(0.1, (point.timestamp - previous.timestamp) / 1000);
    
    if (meters < 2) return;
    if (meters / dt > 10) return;

    lastPoint.current = point;
    const currentSpeed = (meters / dt) * 3.6;
    
    setSpeed(currentSpeed);
    if (currentSpeed > topSpeedRef.current) topSpeedRef.current = currentSpeed;
    
    setDistance(old => { 
      const next = old + meters / 1000; 
      distanceRef.current = next; 
      
      if (Math.floor(next) > lastMilestoneRef.current) {
         lastMilestoneRef.current = Math.floor(next);
         const mins = Math.floor(elapsedRef.current / 60);
         speak(`Milestone reached. Distance: ${lastMilestoneRef.current} kilometers. Elapsed time: ${mins} minutes.`);
      }
      return next; 
    });
    
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
      elapsedBase.current = 0; elapsedRef.current = 0; startAt.current = Date.now(); distanceRef.current = 0; routeRef.current = []; topSpeedRef.current = 0; lastMilestoneRef.current = 0;
      setGhostDrawnRoute([]);
      setElapsed(0); setDistance(0); setSpeed(0); setRoute([]); setGpsMessage("Acquiring GPS signal.");
      speak(ghostRun ? "Ghost race initiated. Target acquired." : "Activity started. GPS locked.");
    } catch (e) { setStatus("ready"); Alert.alert("Error", e?.message); } finally { setBusy(false); }
  };

  const pauseRun = async () => {
    if (status !== "running") return;
    elapsedBase.current = elapsedRef.current; startAt.current = null;
    setStatus("paused"); statusRef.current = "paused"; setSpeed(0); await stopWatch();
    speak("Activity paused.");
  };

  const resumeRun = async () => {
    if (busy) return;
    setBusy(true);
    try {
      setStatus("running"); statusRef.current = "running";
      const ok = await startWatch();
      if (!ok) { setStatus("paused"); statusRef.current = "paused"; return; }
      lastPoint.current = null; startAt.current = Date.now();
      speak("Activity resumed.");
    } catch (e) { setStatus("paused"); Alert.alert("Error", e?.message); } finally { setBusy(false); }
  };

  const resetRun = async () => {
    await stopWatch();
    setStatus("ready"); statusRef.current = "ready";
    setElapsed(0); setDistance(0); setSpeed(0); setAccuracy(null); setGpsMessage("Waiting for GPS"); setRoute([]); setGhostRun(null); setGhostDistance(0); setGhostDrawnRoute([]);
    elapsedBase.current = 0; elapsedRef.current = 0; distanceRef.current = 0; routeRef.current = []; startAt.current = null; lastPoint.current = null; topSpeedRef.current = 0; lastMilestoneRef.current = 0;
  };

  const finishRun = async () => {
    if (status === "ready") { resetRun(); return; }
    
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
         setGhostStats({ current: saved, ghost: ghostRun });
         setShowGhostResult(true);
         const diff = finalDist - ghostRun.distance;
         if (diff >= 0) speak("Session complete. Target defeated. Excellent performance.");
         else speak("Session complete. Target not reached. Keep pushing your limits.");
      } else {
         speak(`Session completed. Total distance: ${finalDist.toFixed(2)} kilometers.`);
      }
    } else {
       speak("Activity stopped.");
    }
    
    await resetRun(); 
    if(!ghostRun) setTab("Stats");
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
            setSongPosition(0);
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
        { shouldPlay: true, progressUpdateIntervalMillis: 500 }
      );
      soundRef.current = newSound;
      setMusicIndex(i);
      setPlaying(true);
      
      newSound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded) {
            setSongPosition(status.positionMillis || 0);
            setSongDuration(status.durationMillis || 1);
            if (status.didJustFinish) {
                playMusicAt(i + 1);
            }
        }
      });
    } catch (e) {
      console.log(e);
      Alert.alert("Playback error", "Could not play this audio file.");
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

  const handleSeek = async (evt) => {
    if (locked) return;
    if (!soundRef.current || songDuration <= 1) return;
    const touchX = evt.nativeEvent.locationX;
    const width = audioWidthRef.current || Dimensions.get('window').width - 30; 
    const percentage = Math.max(0, Math.min(1, touchX / width));
    const seekTo = percentage * songDuration;
    
    setSongPosition(seekTo);
    await soundRef.current.setPositionAsync(seekTo);
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

  const openYTMusic = async () => {
    const ytMusicUrl = 'https://music.youtube.com/';
    const supported = await Linking.canOpenURL(ytMusicUrl);
    if (supported) {
      await Linking.openURL(ytMusicUrl);
    } else {
      await Linking.openURL('https://music.youtube.com/');
    }
  };

  const handleShareClick = () => {
    setDefaultPhoto();
    setShowRouteMap(true);
    setShowVignette(true);
    setShowShareModal(true);
  };

  const setDefaultPhoto = () => {
    const defaultImages = [
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=800&auto=format&fit=crop', 
      'https://images.unsplash.com/photo-1426604966848-d7adac402bff?q=80&w=800&auto=format&fit=crop', 
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=800&auto=format&fit=crop'
    ];
    const randomImage = defaultImages[Math.floor(Math.random() * defaultImages.length)];
    setShareBgImage(randomImage);
  };

  const openSelfieCamera = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status === 'granted') {
      setShowCamera(true);
    } else {
      Alert.alert("Camera permission denied.");
    }
  };

  const takeSelfie = async () => {
      if(cameraRef.current) {
          const photo = await cameraRef.current.takePictureAsync();
          setShareBgImage(photo.uri);
          setShowCamera(false);
      }
  };

  const shareResult = async () => {
    try {
      const uri = await captureRef(viewShotRef, {
        format: "png",
        quality: 1.0
      });
      await Sharing.shareAsync(uri);
    } catch (e) {
      Alert.alert("Error sharing result.");
    }
  };

  const calculateBMI = async () => {
    if (!bmiData.height || !bmiData.weight) {
      Alert.alert("Incomplete Data", "Height aur Weight dono enter karein.");
      return;
    }
    const h = parseFloat(bmiData.height) / 100;
    const w = parseFloat(bmiData.weight);
    if (h <= 0 || w <= 0) return;
    
    const bmiVal = (w / (h * h)).toFixed(1);
    let cat = "";
    let sug = "";

    if (bmiVal < 18.5) {
      cat = "Underweight";
      sug = "Aapka weight thoda kam hai. Protein-rich diet lein aur muscle building pe focus karein.";
    } else if (bmiVal >= 18.5 && bmiVal <= 24.9) {
      cat = "Normal";
      sug = "Perfect BMI! Apni current running aur fitness routine ko isi tarah maintain karein. Keep it up!";
    } else if (bmiVal >= 25 && bmiVal <= 29.9) {
      cat = "Overweight";
      sug = "Thoda weight zyada hai. Apni runs ko thoda lamba karein aur mild calorie deficit try karein.";
    } else {
      cat = "Obese";
      sug = "High health risk. Diet pe control karein aur consistency ke sath daily walking/running karein.";
    }

    const payload = { ...bmiData, bmi: bmiVal, category: cat, suggestion: sug };
    setSavedBmi(payload);
    await AsyncStorage.setItem(BMI_KEY, JSON.stringify(payload));
    setShowBmiModal(false);
  };

  const liveSpeed = speed > 0.3 ? speed.toFixed(1) : "0.0";
  const livePace = speed > 0.3 ? paceText(3600, speed) : "--:--";
  const maxGraphDist = Math.max(...history.slice(0, 7).map(h => h.distance), 1);
  const progressPercent = Math.min(100, (songPosition / songDuration) * 100);

  const totalDistance = history.reduce((acc, curr) => acc + curr.distance, 0);
  const totalDuration = history.reduce((acc, curr) => acc + curr.duration, 0);
  const topRuns = [...history].sort((a, b) => b.distance - a.distance);
  const bestRun = topRuns.length > 0 ? topRuns[0] : null;

  // New Compact Render Function for Lists
  const renderCompactRun = (item, isTop = false, rank = 0, isLast = false) => (
    <TouchableOpacity key={`${isTop ? 'top' : 'rec'}-${item.id}`} style={[s.compactRunRow, isLast && {borderBottomWidth: 0}]} onPress={() => { setShowAllHistory(false); setSelectedRun(item); }} activeOpacity={0.8}>
       <View style={{flexDirection: 'row', alignItems: 'center'}}>
         {isTop ? (
           <Text style={{color: rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32', fontWeight: '900', fontSize: 14, width: 22}}>{rank}</Text>
         ) : (
           <View style={{width: 6, height: 6, borderRadius: 3, backgroundColor: LIME, marginRight: 12}} />
         )}
         <View>
           <Text style={{color: '#FFF', fontSize: 16, fontWeight: '800'}}>{item.distance.toFixed(2)} <Text style={{color: MUTED, fontSize: 11}}>km</Text></Text>
           <Text style={{color: MUTED, fontSize: 10, marginTop: 2}}>{new Date(item.date).toLocaleDateString()}</Text>
         </View>
       </View>
       <View style={{alignItems: 'flex-end'}}>
         <Text style={{color: '#FFF', fontSize: 14, fontWeight: '700'}}>{timeText(item.duration)}</Text>
         <Text style={{color: LIME, fontSize: 10, fontWeight: '600', marginTop: 2}}>{item.pace} /km</Text>
       </View>
    </TouchableOpacity>
  );

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
            disabled={locked}
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
            <Text style={s.timer} adjustsFontSizeToFit numberOfLines={1}>{timeText(elapsed)}</Text>
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

      <View style={s.grid}>
        <Metric icon="navigate" label="DISTANCE" value={distance.toFixed(2)} unit="km" note={gpsMessage} iconBg={LIME} iconColor="#000" dotColor={LIME} />
        <Metric icon="flash" label="LIVE PACE" value={livePace} unit="/km" note="Calculating..." iconBg="#3B82F6" iconColor="#FFF" dotColor="#3B82F6" />
        <Metric icon="flash" label="LIVE SPEED" value={liveSpeed} unit="km/h" note="Live GPS" iconBg="#8B5CF6" iconColor="#FFF" dotColor="#3B82F6" />
        <Metric icon="flame" label="CALORIES" value={String(Math.round(distance * 60))} unit="kcal" note="Burning energy" iconBg="#EF4444" iconColor="#FFF" dotColor="#EF4444" />
      </View>

      <TouchableOpacity style={[s.liveMapCard, locked && { opacity: 0.6 }]} onPress={() => setTab("Map")} activeOpacity={0.8} disabled={locked}>
         <View style={s.liveMapLeft}>
           <View style={s.liveMapIconBox}>
              <Ionicons name="map" size={20} color={LIME} />
           </View>
           <View>
              <Text style={s.liveMapTitle}>Live Route Map</Text>
              <Text style={s.liveMapSub}>Track your path in real-time</Text>
           </View>
         </View>
         <View style={s.liveMapGoBtn}>
           <Text style={s.liveMapGoText}>OPEN</Text>
           <Ionicons name="chevron-forward" size={14} color="#000" />
         </View>
      </TouchableOpacity>

      <View style={[s.musicMiniContainer, { marginTop: 'auto' }, locked && { opacity: 0.6 }]}>
        <TouchableOpacity 
           activeOpacity={0.9} 
           style={s.progressContainer} 
           onPress={handleSeek}
           onLayout={(e) => audioWidthRef.current = e.nativeEvent.layout.width}
           disabled={locked}
        >
           <View style={s.progressBg}>
              <View style={[s.progressFill, { width: `${progressPercent}%` }]} />
              <View style={[s.progressThumb, { left: `${progressPercent}%` }]} />
           </View>
        </TouchableOpacity>

        <View style={s.musicMini}>
          <TouchableOpacity style={s.musicMiniLeft} onPress={files.length === 0 ? chooseMusic : undefined} disabled={locked}>
             <Ionicons name="musical-note" size={14} color={MUTED} style={{marginTop: 2}}/>
             <View style={s.musicMiniTextContainer}>
                <Text numberOfLines={1} style={s.musicMiniTitle}>{files[musicIndex]?.name || "Choose music to play..."}</Text>
                {files.length > 0 && <Text style={s.musicMiniTime}>{formatAudioTime(songPosition)} / {formatAudioTime(songDuration)}</Text>}
             </View>
          </TouchableOpacity>
          <View style={s.musicControls}>
            <TouchableOpacity style={s.miniControl} onPress={() => playMusicAt(musicIndex - 1)} disabled={locked}>
              <Ionicons name="play-skip-back" size={16} color="#DCE6EF" />
            </TouchableOpacity>
            <TouchableOpacity style={s.miniPlay} onPress={toggleMusic} disabled={locked}>
              <Ionicons name={playing ? "pause" : "play"} size={16} color="#000" style={!playing ? { marginLeft: 2 } : {}} />
            </TouchableOpacity>
            <TouchableOpacity style={s.miniControl} onPress={() => playMusicAt(musicIndex + 1)} disabled={locked}>
              <Ionicons name="play-skip-forward" size={16} color="#DCE6EF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
            
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 18}}>
               <TouchableOpacity onPress={handleShareClick}>
                  <Ionicons name="share-social" size={22} color={LIME} />
               </TouchableOpacity>
               <TouchableOpacity onPress={() => deleteHistory(selectedRun.id)}>
                  <Ionicons name="trash-outline" size={22} color="#FF4444" />
               </TouchableOpacity>
            </View>
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

         <Modal visible={showShareModal} animationType="slide" transparent>
            <View style={{flex: 1, backgroundColor: BG, paddingTop: 40}}>
               <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15}}>
                  <Text style={{color: '#FFF', fontSize: 20, fontWeight: 'bold'}}>Share Activity</Text>
                  <TouchableOpacity onPress={() => setShowShareModal(false)}>
                      <Ionicons name="close" size={28} color="#FFF"/>
                  </TouchableOpacity>
               </View>

               {showCamera ? (
                  <View style={{flex: 1}}>
                      <CameraView style={{flex: 1}} facing="front" ref={cameraRef}>
                         <View style={{flex:1, justifyContent:'flex-end', alignItems:'center', paddingBottom: 40}}>
                            <TouchableOpacity onPress={takeSelfie} style={{width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.5)', borderWidth: 5, borderColor: '#FFF'}}/>
                         </View>
                      </CameraView>
                  </View>
               ) : (
                  <View style={{flex: 1, padding: 10}}>
                     <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1.0 }} style={{borderRadius: 20, overflow: 'hidden', flex: 1, backgroundColor: '#000'}}>
                        <ImageBackground source={{uri: shareBgImage}} style={{flex: 1}} resizeMode="cover">
                           
                           {showVignette && <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />}

                           <View style={{position: 'absolute', top: 35, left: 25}}>
                              <Text style={{color: '#FFF', fontSize: 24, fontWeight: '900', fontStyle: 'italic', letterSpacing: 1, paddingRight: 10}}>
                                 RAFTAAR
                              </Text>
                              <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4}}>
                                  <Ionicons name="calendar-outline" size={10} color={LIME} style={{marginRight: 4}} />
                                  <Text style={{color: '#FFF', fontSize: 10, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 2}}>
                                     {new Date(selectedRun.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(selectedRun.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </Text>
                              </View>
                           </View>

                           <View style={{position: 'absolute', bottom: 40, right: 25, alignItems: 'flex-end'}}>
                              
                              {showRouteMap && selectedRun.distance >= 0.02 && selectedRun.route && selectedRun.route.length > 2 && (
                                 <View style={{position: 'absolute', right: -20, top: -50, bottom: 0, zIndex: -1, opacity: 0.9}}>
                                    <Svg width={250} height={400} viewBox="0 0 250 400">
                                       <SvgPolyline 
                                          points={getSvgPoints(selectedRun.route, 250, 400)} 
                                          fill="none" 
                                          stroke={LIME} 
                                          strokeWidth="6" 
                                          strokeLinecap="round" 
                                          strokeLinejoin="round" 
                                       />
                                    </Svg>
                                 </View>
                              )}

                              <Text style={{color: '#FFF', fontSize: 11, fontWeight: '700'}}>Distance</Text>
                              <View style={{flexDirection: 'row', alignItems: 'baseline', marginBottom: 15}}>
                                 <Text style={{color: '#FFF', fontSize: 44, fontWeight: '900'}}>{selectedRun.distance?.toFixed(2)}</Text>
                                 <Text style={{color: '#FFF', fontSize: 18, fontWeight: '800', marginLeft: 4}}>km</Text>
                              </View>

                              <Text style={{color: '#FFF', fontSize: 11, fontWeight: '700'}}>Pace</Text>
                              <Text style={{color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 12}}>{selectedRun.pace} /km</Text>

                              <Text style={{color: '#FFF', fontSize: 11, fontWeight: '700'}}>Time</Text>
                              <Text style={{color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 12}}>{timeText(selectedRun.duration)}</Text>

                              <Text style={{color: '#FFF', fontSize: 11, fontWeight: '700'}}>Calories</Text>
                              <Text style={{color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 12}}>{selectedRun.calories}</Text>

                              <Text style={{color: '#FFF', fontSize: 11, fontWeight: '700'}}>Top Speed</Text>
                              <Text style={{color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 12}}>{selectedRun.topSpeed} km/h</Text>
                              
                              <Text style={{color: '#FFF', fontSize: 11, fontWeight: '700'}}>Avg Speed</Text>
                              <Text style={{color: '#FFF', fontSize: 18, fontWeight: '800'}}>{selectedRun.avgSpeed} km/h</Text>
                           </View>

                        </ImageBackground>
                     </ViewShot>

                     <View style={{paddingVertical: 20}}>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20}}>
                           
                           <TouchableOpacity onPress={setDefaultPhoto} style={{alignItems: 'center', width: '23%'}}>
                              <View style={{backgroundColor: CARD, height: 50, width: '100%', borderRadius: 15, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center'}}><Ionicons name="image" size={22} color={LIME}/></View>
                              <Text style={{color: '#FFF', fontSize: 11, marginTop: 6}}>Photo</Text>
                           </TouchableOpacity>
                           
                           <TouchableOpacity onPress={openSelfieCamera} style={{alignItems: 'center', width: '23%'}}>
                              <View style={{backgroundColor: CARD, height: 50, width: '100%', borderRadius: 15, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center'}}><Ionicons name="camera" size={22} color={LIME}/></View>
                              <Text style={{color: '#FFF', fontSize: 11, marginTop: 6}}>Selfie</Text>
                           </TouchableOpacity>
                           
                           <View style={{alignItems: 'center', width: '23%'}}>
                              <View style={{backgroundColor: CARD, height: 50, width: '100%', borderRadius: 15, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center'}}>
                                 <Switch value={showVignette} onValueChange={setShowVignette} trackColor={{ false: "#2A3644", true: LIME }} thumbColor="#FFF" style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}/>
                              </View>
                              <Text style={{color: '#FFF', fontSize: 11, marginTop: 6}}>Vignette</Text>
                           </View>

                           <View style={{alignItems: 'center', width: '23%'}}>
                              <View style={{backgroundColor: CARD, height: 50, width: '100%', borderRadius: 15, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center'}}>
                                 <Switch value={showRouteMap} onValueChange={setShowRouteMap} trackColor={{ false: "#2A3644", true: LIME }} thumbColor="#FFF" style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}/>
                              </View>
                              <Text style={{color: '#FFF', fontSize: 11, marginTop: 6}}>Route</Text>
                           </View>

                        </View>
                        
                        <TouchableOpacity onPress={shareResult} style={{backgroundColor: LIME, padding: 16, borderRadius: 15, alignItems: 'center', elevation: 5}}>
                           <Text style={{color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 1}}>SHARE</Text>
                        </TouchableOpacity>
                     </View>
                  </View>
               )}
            </View>
         </Modal>

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
          
          {tab === "Stats" && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
               <Text style={s.pageTitle}>Statistics</Text>

               {/* 1. RECENT ACTIVITY (COMPACT) */}
               <View style={s.premiumCardWrapper}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
                     <Text style={s.sectionHeader}>RECENT ACTIVITY</Text>
                     {history.length > 3 && (
                        <TouchableOpacity onPress={() => setShowAllHistory(true)}>
                           <Text style={{color: LIME, fontSize: 11, fontWeight: '700'}}>SHOW ALL</Text>
                        </TouchableOpacity>
                     )}
                  </View>
                  {history.length > 0 ? (
                     <View>
                        {history.slice(0, 3).map((item, index) => renderCompactRun(item, false, 0, index === Math.min(history.length, 3) - 1))}
                     </View>
                  ) : (
                     <Text style={{color:MUTED, textAlign:'center', marginVertical: 10, fontSize: 12}}>No runs saved yet.</Text>
                  )}
               </View>
               
               {/* 2. OVERALL PROGRESS */}
               <View style={s.premiumCardWrapper}>
                  <Text style={s.sectionHeader}>OVERALL PROGRESS</Text>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                     <View style={{alignItems: 'center', flex: 1}}>
                        <Text style={{color: MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 1}}>DISTANCE</Text>
                        <Text style={{color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 4}}>{totalDistance.toFixed(1)} <Text style={{fontSize: 12, color: LIME}}>km</Text></Text>
                     </View>
                     <View style={{width: 1, backgroundColor: BORDER}} />
                     <View style={{alignItems: 'center', flex: 1}}>
                        <Text style={{color: MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 1}}>TIME</Text>
                        <Text style={{color: '#FFF', fontSize: 20, fontWeight: '900', marginTop: 8}}>{timeText(totalDuration)}</Text>
                     </View>
                     <View style={{width: 1, backgroundColor: BORDER}} />
                     <View style={{alignItems: 'center', flex: 1}}>
                        <Text style={{color: MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 1}}>RUNS</Text>
                        <Text style={{color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 4}}>{history.length}</Text>
                     </View>
                  </View>
               </View>

               {/* 3. CONSISTENCY GRAPH */}
               {history.length > 0 && (
                 <View style={s.premiumCardWrapper}>
                   <Text style={s.sectionHeader}>CONSISTENCY (Last 7 Runs)</Text>
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

               {/* 4. TOP 3 RUNS (COMPACT) */}
               {history.length > 1 && (
                  <View style={s.premiumCardWrapper}>
                     <Text style={s.sectionHeader}>LEADERBOARD (TOP 3)</Text>
                     <View>
                        {topRuns.slice(0, 3).map((item, index) => renderCompactRun(item, true, index + 1, index === Math.min(topRuns.length, 3) - 1))}
                     </View>
                  </View>
               )}

               {/* 5. PERSONAL BEST (HIGHLIGHT CARD) */}
               {bestRun && (
                  <View style={[s.premiumCardWrapper, {borderColor: '#FFD700', backgroundColor: 'rgba(255, 215, 0, 0.05)'}]}>
                     <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15}}>
                        <Ionicons name="trophy" size={18} color="#FFD700" />
                        <Text style={[s.sectionHeader, {marginBottom: 0, color: '#FFD700'}]}>PERSONAL BEST</Text>
                     </View>
                     <TouchableOpacity onPress={() => setSelectedRun(bestRun)} activeOpacity={0.8} style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                        <View>
                           <Text style={{color: '#FFF', fontSize: 32, fontWeight: '900'}}>{bestRun.distance.toFixed(2)} <Text style={{fontSize: 16, color: LIME}}>km</Text></Text>
                           <Text style={{color: MUTED, fontSize: 11, marginTop: 4}}>{new Date(bestRun.date).toLocaleDateString()} • {timeText(bestRun.duration)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={MUTED} />
                     </TouchableOpacity>
                  </View>
               )}

               {/* 6. BMI CALCULATOR WIDGET */}
               <View style={s.premiumCardWrapper}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
                     <Text style={s.sectionHeader}>BODY PROFILE (BMI)</Text>
                     <TouchableOpacity onPress={() => setShowBmiModal(true)}>
                        <Ionicons name="pencil" size={16} color={LIME} />
                     </TouchableOpacity>
                  </View>
                  
                  {savedBmi ? (
                     <View style={{alignItems: 'center'}}>
                        <View style={{flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 5}}>
                           <Text style={{color: '#FFF', fontSize: 40, fontWeight: '900'}}>{savedBmi.bmi}</Text>
                           <View style={{backgroundColor: savedBmi.category === 'Normal' ? LIME : savedBmi.category === 'Underweight' ? '#3B82F6' : '#EF4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10}}>
                              <Text style={{color: '#000', fontSize: 10, fontWeight: '800'}}>{savedBmi.category}</Text>
                           </View>
                        </View>
                        <Text style={{color: MUTED, fontSize: 12, textAlign: 'center', marginTop: 5, paddingHorizontal: 10}}>{savedBmi.suggestion}</Text>
                     </View>
                  ) : (
                     <View style={{alignItems: 'center', paddingVertical: 10}}>
                        <Text style={{color: MUTED, fontSize: 12, marginBottom: 15}}>No body profile data found.</Text>
                        <TouchableOpacity style={{backgroundColor: LIME, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12}} onPress={() => setShowBmiModal(true)}>
                           <Text style={{color: '#000', fontWeight: '800', fontSize: 12}}>CALCULATE BMI</Text>
                        </TouchableOpacity>
                     </View>
                  )}
               </View>

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
                        
                        {ghostRun && ghostDrawnRoute.length > 0 && (
                           <>
                              <Polyline coordinates={ghostDrawnRoute} strokeColor="#FF4444" strokeWidth={4} strokeDashPattern={[10, 10]} />
                              <Marker coordinate={ghostDrawnRoute[ghostDrawnRoute.length - 1]}>
                                  <Ionicons name="ghost" size={22} color="#FF4444" />
                              </Marker>
                           </>
                        )}
                    </MapView>
                 ) : ( <Text style={{color: MUTED, textAlign: 'center', marginTop: 50}}>{gpsMessage}</Text> )}
               </View>
             </View>
          )}
          
          {tab === "Music" && (
             <View style={{flex: 1}}>
               <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 120}}>
                 <Text style={s.pageTitle}>Playlist</Text>
                 <View style={{flexDirection: 'row', gap: 10, marginBottom: 20}}>
                     <TouchableOpacity style={[s.addMusic, {flex: 1, marginBottom: 0}]} onPress={chooseMusic} activeOpacity={0.8}>
                         <Text style={{color: '#000', fontWeight: '800', letterSpacing: 0.5, textAlign: 'center'}}>ADD MUSIC</Text>
                     </TouchableOpacity>
                     <TouchableOpacity style={[s.addMusic, {flex: 1, marginBottom: 0, backgroundColor: '#FF0000', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6}]} onPress={openYTMusic} activeOpacity={0.8}>
                         <Ionicons name="logo-youtube" size={18} color="#FFF" />
                         <Text style={{color: '#FFF', fontWeight: '800', letterSpacing: 0.5}}>YT MUSIC</Text>
                     </TouchableOpacity>
                 </View>
                 
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

               {files.length > 0 && (
                  <View style={s.floatingPlayerContainer}>
                    <TouchableOpacity 
                       activeOpacity={0.9} 
                       style={s.progressContainer} 
                       onPress={handleSeek}
                       onLayout={(e) => audioWidthRef.current = e.nativeEvent.layout.width}
                    >
                       <View style={s.progressBg}>
                          <View style={[s.progressFill, { width: `${progressPercent}%` }]} />
                          <View style={[s.progressThumb, { left: `${progressPercent}%` }]} />
                       </View>
                    </TouchableOpacity>

                    <View style={s.floatingPlayer}>
                      <View style={{flex: 1, paddingRight: 10}}>
                         <Ionicons name="musical-note" size={12} color={MUTED} />
                         <Text numberOfLines={1} style={{color:'#FFF', fontSize:12, fontWeight:'600', marginTop:2}}>
                           {files[musicIndex]?.name || "Select a track"}
                         </Text>
                         <Text style={{color: MUTED, fontSize: 9, marginTop:2}}>{formatAudioTime(songPosition)} / {formatAudioTime(songDuration)}</Text>
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
                  </View>
               )}
             </View>
          )}
        </View>

        <View style={[s.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents={locked ? "none" : "auto"}>
          {[{ name: "Run", icon: "flash" }, { name: "Music", icon: "musical-notes-outline" }, { name: "Map", icon: "map-outline" }, { name: "Stats", icon: "stats-chart" }].map(item => {
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

        {/* BMI Modal */}
        <Modal visible={showBmiModal} transparent animationType="slide">
           <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)'}}>
              <View style={{backgroundColor: CARD, padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderColor: BORDER}}>
                 <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25}}>
                    <Text style={{color: '#FFF', fontSize: 20, fontWeight: '800'}}>Body Profile</Text>
                    <TouchableOpacity onPress={() => setShowBmiModal(false)}><Ionicons name="close" size={24} color={MUTED} /></TouchableOpacity>
                 </View>
                 
                 <Text style={{color: MUTED, fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 4}}>HEIGHT (cm)</Text>
                 <TextInput style={s.inputField} keyboardType="numeric" placeholder="e.g. 175" placeholderTextColor={MUTED} value={bmiData.height} onChangeText={t => setBmiData({...bmiData, height: t})} />

                 <Text style={{color: MUTED, fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 4}}>WEIGHT (kg)</Text>
                 <TextInput style={s.inputField} keyboardType="numeric" placeholder="e.g. 70" placeholderTextColor={MUTED} value={bmiData.weight} onChangeText={t => setBmiData({...bmiData, weight: t})} />

                 <Text style={{color: MUTED, fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 4}}>GENDER</Text>
                 <View style={{flexDirection: 'row', gap: 15, marginBottom: 30}}>
                    {['Male', 'Female'].map(g => (
                       <TouchableOpacity key={g} onPress={() => setBmiData({...bmiData, gender: g})} style={[s.genderBtn, bmiData.gender === g && {backgroundColor: LIME, borderColor: LIME}]}>
                          <Text style={{color: bmiData.gender === g ? '#000' : MUTED, fontWeight: '700'}}>{g}</Text>
                       </TouchableOpacity>
                    ))}
                 </View>

                 <TouchableOpacity style={{backgroundColor: LIME, padding: 18, borderRadius: 16, alignItems: 'center'}} onPress={calculateBMI}>
                    <Text style={{color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 1}}>SAVE & CALCULATE</Text>
                 </TouchableOpacity>
              </View>
           </KeyboardAvoidingView>
        </Modal>

        {/* All History Modal with Large Cards */}
        <Modal visible={showAllHistory} transparent animationType="slide">
           <View style={{flex: 1, backgroundColor: BG, paddingTop: 50}}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20}}>
                 <Text style={{color: '#FFF', fontSize: 24, fontWeight: '800'}}>All History</Text>
                 <TouchableOpacity onPress={() => setShowAllHistory(false)}><Ionicons name="close" size={28} color="#FFF" /></TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{padding: 15, paddingBottom: 50}}>
                 {history.map(item => (
                   <TouchableOpacity key={item.id} style={s.premiumCard} onPress={() => { setShowAllHistory(false); setSelectedRun(item); }} activeOpacity={0.8}>
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
              </ScrollView>
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
  mainWrapper: { flex: 1, paddingHorizontal: 14, paddingTop: 5, paddingBottom: 0, justifyContent: "space-between" },
  
  runContainer: { flex: 1 }, 
  scrollContent: { paddingBottom: 20 },

  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  brandLeft: { flexDirection: "row", alignItems: "center" },
  brandIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#152014", borderWidth: 1, borderColor: "#304221", alignItems: "center", justifyContent: "center" },
  brandText: { marginLeft: 10 },
  brandTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  brandSubtitle: { color: MUTED, fontSize: 11 },
  
  voiceCommandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  voiceText: { color: MUTED, fontSize: 11, fontWeight: "600" },

  heroContainer: { flex: 1, maxHeight: 270, marginBottom: 15, borderRadius: 28, overflow: "hidden", elevation: 5, backgroundColor: "#111" },
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
  timer: { color: "#FFFFFF", fontSize: 56, fontWeight: "900", fontVariant: ["tabular-nums"], lineHeight: 65, paddingHorizontal: 10 },
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

  liveMapCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#121A23', borderRadius: 20, padding: 12, borderWidth: 1, borderColor: '#1E2A38', shadowColor: "#000", shadowOffset:{width:0, height:4}, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  liveMapLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  liveMapIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#1A2633', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A3644' },
  liveMapTitle: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  liveMapSub: { color: MUTED, fontSize: 11, fontWeight: '500', marginTop: 2 },
  liveMapGoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: LIME, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, gap: 4 },
  liveMapGoText: { color: '#000', fontWeight: '800', fontSize: 10 },

  musicMiniContainer: { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, overflow: 'hidden', marginBottom: 10 },
  progressContainer: { height: 24, justifyContent: 'center', width: '100%', paddingHorizontal: 15, marginTop: 5 },
  progressBg: { height: 4, backgroundColor: '#1E2A38', borderRadius: 2, width: '100%', flexDirection: 'row', alignItems: 'center' },
  progressFill: { height: '100%', backgroundColor: LIME, borderRadius: 2 },
  progressThumb: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFF', position: 'absolute', marginLeft: -6 },
  
  musicMini: { flexDirection: "row", alignItems: "center", paddingBottom: 10, paddingHorizontal: 14, gap: 10, justifyContent: 'space-between' },
  musicMiniLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 8, paddingRight: 10 }, 
  musicMiniTextContainer: { flex: 1 }, 
  musicMiniTitle: { color: "#D1DDE8", fontSize: 12, fontWeight: "600" }, 
  musicMiniTime: { color: MUTED, fontSize: 9, marginTop: 2 },
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
  
  premiumCardWrapper: { backgroundColor: CARD, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: BORDER, marginBottom: 16, shadowColor: "#000", shadowOffset: {width: 0, height: 8}, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 },
  sectionHeader: { color: MUTED, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 15 },
  premiumCard: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 10 },
  compactRunRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  historyDate: { color: MUTED, fontSize: 11, fontWeight: '600' },
  historyValue: { color: "#FFF", fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  inputField: { backgroundColor: '#1A2633', color: '#FFF', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 20, fontSize: 16, fontWeight: '600' },
  genderBtn: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: BORDER, alignItems: 'center' },
  
  musicCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: BORDER, marginBottom: 12, shadowColor: "#000", shadowOffset:{width:0, height:4}, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  
  floatingPlayerContainer: { position: 'absolute', bottom: 10, left: 10, right: 10, backgroundColor: '#1A2633', borderRadius: 24, elevation: 10, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },
  floatingPlayer: { paddingBottom: 10, paddingTop: 4, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
