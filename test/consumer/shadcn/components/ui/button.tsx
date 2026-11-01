// A shadcn/ui file: it may render <button>, import Radix primitives and hold a component with its parts.
import { Root } from "@radix-ui/react-tabs";

export function Button(props: { label: string }): JSX.Element {
  return <button type="button">{props.label}</button>;
}

export function ButtonTabs(): JSX.Element {
  return <Root />;
}
