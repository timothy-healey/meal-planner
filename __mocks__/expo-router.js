const NOOP = () => {};

module.exports = {
  __esModule: true,
  useFocusEffect: NOOP,
  useRouter: () => ({ push: NOOP, replace: NOOP, back: NOOP }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  usePathname: () => '/',
  Link: ({ children }) => children,
  router: { push: NOOP, replace: NOOP, back: NOOP },
};
