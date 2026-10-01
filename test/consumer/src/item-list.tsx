// Valid Solid: a component body runs once, so `class`, reading the clock during setup, reassigning a
// local from a handler and `.map()` without keys are fine. React's correctness rules report each of them.
export function ItemList(props: { items: readonly string[] }): JSX.Element {
  let clicks = 0;
  const createdAt = Date.now();
  return (
    <ul class="items" data-created-at={createdAt} onClick={() => (clicks += 1)}>
      {props.items.map((item) => (
        <li>{item}</li>
      ))}
    </ul>
  );
}
