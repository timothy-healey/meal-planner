import { Alert } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useBuildPlan } from '../../hooks/useBuildPlan';

const mockCreate = jest.fn().mockResolvedValue('new-plan');
const mockItems = { current: [] as unknown[] };
const mockPlan = { current: { row: { id: 'p1', source: 'imported' } } as unknown };

jest.mock('../../hooks/usePlan', () => ({
  usePlan: () => ({
    plan: mockPlan.current, loading: false,
    createSelfBuiltPlan: mockCreate, refresh: jest.fn(),
  }),
}));
jest.mock('../../hooks/useShoppingItems', () => ({
  useShoppingItems: () => ({ items: mockItems.current, loading: false }),
}));

const row = (over: Record<string, unknown> = {}) =>
  ({ is_checked: 0, item_key: 'name:x', ...over });

/** Fire the alert's given button as if the user tapped it. */
function tapAlertButton(label: string) {
  const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
  const button = (buttons as { text: string; onPress?: () => void }[])
    .find((b) => b.text === label);
  button?.onPress?.();
}

describe('useBuildPlan', () => {
  beforeEach(() => {
    mockCreate.mockClear();
    mockItems.current = [];
    mockPlan.current = { row: { id: 'p1', source: 'imported' } };
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => { (Alert.alert as jest.Mock).mockRestore(); });

  it('builds immediately when nothing would be stranded', async () => {
    mockItems.current = [row(), row()];
    const { result } = renderHook(() => useBuildPlan());
    await act(async () => { result.current.buildPlan(); });
    expect(Alert.alert).not.toHaveBeenCalled();
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
  });

  it('builds immediately when there is no plan at all', async () => {
    mockPlan.current = null;
    const { result } = renderHook(() => useBuildPlan());
    await act(async () => { result.current.buildPlan(); });
    expect(Alert.alert).not.toHaveBeenCalled();
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
  });

  it('warns before replacing a plan with checked items', async () => {
    mockItems.current = [row({ is_checked: 1 })];
    const { result } = renderHook(() => useBuildPlan());
    await act(async () => { result.current.buildPlan(); });
    expect(Alert.alert).toHaveBeenCalled();
    const [title, body] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toMatch(/Replace your current plan/i);
    expect(body).toMatch(/1 item is checked off/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('warns about hand-added rows — no recipe can recreate those', async () => {
    mockItems.current = [row({ item_key: null })];
    const { result } = renderHook(() => useBuildPlan());
    await act(async () => { result.current.buildPlan(); });
    expect((Alert.alert as jest.Mock).mock.calls[0][1]).toMatch(/added by hand/);
  });

  it('builds when the warning is accepted', async () => {
    mockItems.current = [row({ is_checked: 1 })];
    const { result } = renderHook(() => useBuildPlan());
    await act(async () => { result.current.buildPlan(); });
    await act(async () => { tapAlertButton('Replace'); });
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
  });

  it('does not build when the warning is cancelled', async () => {
    mockItems.current = [row({ is_checked: 1 })];
    const { result } = renderHook(() => useBuildPlan());
    await act(async () => { result.current.buildPlan(); });
    await act(async () => { tapAlertButton('Cancel'); });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('calls onDone after building', async () => {
    const onDone = jest.fn();
    const { result } = renderHook(() => useBuildPlan(onDone));
    await act(async () => { result.current.buildPlan(); });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('creates the plan for the current week starting Sunday', async () => {
    const { result } = renderHook(() => useBuildPlan());
    await act(async () => { result.current.buildPlan(); });
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const iso = mockCreate.mock.calls[0][0] as string;
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const [y, m, d] = iso.split('-').map(Number);
    expect(new Date(y, m - 1, d).getDay()).toBe(0);
  });
});
