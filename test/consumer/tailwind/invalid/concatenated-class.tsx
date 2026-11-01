export function Badge(props: { tone: string }): JSX.Element {
  return <span className={"text-" + props.tone}>badge</span>;
}
