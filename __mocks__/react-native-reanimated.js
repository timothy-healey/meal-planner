// Manual mock for react-native-reanimated (v4 mock is broken in Jest due to
// react-native-worklets native module requirement).
const React = require('react');
const { View, Text, Image, ScrollView } = require('react-native');

const NOOP = () => {};
const ID = (t) => t;

const Animated = {
  View,
  Text,
  Image,
  ScrollView,
  createAnimatedComponent: (component) => component,
  Value: jest.fn(() => ({ setValue: NOOP })),
  event: NOOP,
  timing: NOOP,
  spring: NOOP,
  decay: NOOP,
  parallel: NOOP,
  sequence: NOOP,
  loop: NOOP,
  start: NOOP,
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,

  // Entrance/exit animations — no-ops in tests
  FadeIn: { duration: () => ({ build: NOOP }) },
  FadeOut: { duration: () => ({ build: NOOP }) },
  SlideInRight: { duration: () => ({ build: NOOP }) },
  SlideOutLeft: { duration: () => ({ build: NOOP }) },
  ZoomIn: { duration: () => ({ build: NOOP }) },
  ZoomOut: { duration: () => ({ build: NOOP }) },
  Layout: { duration: () => ({ build: NOOP }) },

  // Hooks
  useSharedValue: (val) => ({ value: val }),
  useAnimatedStyle: (fn) => {
    try { return fn(); } catch { return {}; }
  },
  useAnimatedRef: () => ({ current: null }),
  useAnimatedScrollHandler: () => NOOP,
  useAnimatedGestureHandler: () => NOOP,
  useAnimatedProps: (fn) => {
    try { return fn(); } catch { return {}; }
  },
  useDerivedValue: (fn) => {
    try { return { value: fn() }; } catch { return { value: undefined }; }
  },
  useAnimatedReaction: NOOP,
  useScrollViewOffset: () => ({ value: 0 }),
  useEvent: (_handler, _eventNames, _rebuild) => NOOP,
  useHandler: (_handlers, _deps) => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
  useAnimatedKeyboard: () => ({ height: { value: 0 }, state: { value: 0 } }),
  useAnimatedSensor: () => ({ sensor: { value: {} }, unregister: NOOP }),

  // Worklet-compatible functions
  withTiming: (toValue, _config, callback) => {
    if (callback) callback(true);
    return toValue;
  },
  withSpring: (toValue, _config, callback) => {
    if (callback) callback(true);
    return toValue;
  },
  withDecay: (config, callback) => {
    if (callback) callback(true);
    return config.velocity ?? 0;
  },
  withDelay: (_delay, animation) => animation,
  withSequence: (...animations) => animations[animations.length - 1],
  withRepeat: (animation) => animation,
  cancelAnimation: NOOP,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,

  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },

  interpolate: (value, input, output) => {
    if (!input || !output || input.length === 0) return 0;
    const idx = input.findIndex((v, i) => i < input.length - 1 && value >= v && value <= input[i + 1]);
    if (idx === -1) return output[output.length - 1];
    const t = (value - input[idx]) / (input[idx + 1] - input[idx]);
    return output[idx] + t * (output[idx + 1] - output[idx]);
  },
  interpolateColor: (value, input, output) => output[0] ?? '#000',

  measure: NOOP,
  scrollTo: NOOP,
  setNativeProps: NOOP,

  createAnimatedComponent: (component) => component,
};
