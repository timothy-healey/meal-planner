// Jest setup file
// react-native-reanimated is mocked via __mocks__/react-native-reanimated.js
// (the official mock requires native worklets and crashes in Jest with RN v4)

jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest')
);
