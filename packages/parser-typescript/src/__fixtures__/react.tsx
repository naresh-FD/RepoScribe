declare namespace JSX {
  interface Element {}
}

declare function useState<T>(value: T): [T, (next: T) => void];
declare function useMemo<T>(factory: () => T, dependencies: unknown[]): T;

export interface ButtonProps {
  /** Text displayed inside the button. */
  label: string;
  /** Visual button tone. */
  tone?: "primary" | "secondary";
}

/** Displays an actionable button. */
export function Button(
  { label, tone = "primary" }: ButtonProps
): JSX.Element {
  return <button data-tone={tone}>{label}</button>;
}

Button.defaultProps = {
  tone: "secondary",
};

/** Manages a counter value. */
export function useCounter(initial: number): [number, (next: number) => void] {
  const [count, setCount] = useState(initial);
  const stableCount = useMemo(() => count, [count]);
  return [stableCount, setCount];
}
