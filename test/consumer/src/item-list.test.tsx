// Test files may define several helper components; the react override excludes them.
export function EmptyList(): JSX.Element {
  return <ul />;
}

export function SingleItemList(): JSX.Element {
  return (
    <ul>
      <li>one</li>
    </ul>
  );
}
