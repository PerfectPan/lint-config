// The shadcn fixtures import Radix packages that are not installed; only the import specifiers matter to the rules.
declare module "@radix-ui/react-slot" {
  export const Slot: (props: Record<string, unknown>) => JSX.Element;
}
declare module "@radix-ui/react-tabs" {
  export const Root: (props: Record<string, unknown>) => JSX.Element;
}
