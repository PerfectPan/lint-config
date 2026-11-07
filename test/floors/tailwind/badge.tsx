// bg-brand and text-body exist only in theme.css, so this passes only when the rules compile that stylesheet.
// Arbitrary values without a literal colour or length, such as variants and ch widths, are allowed.
export function Badge(props: { active: boolean }): JSX.Element {
  return (
    <span className={props.active ? "bg-brand text-body" : "max-w-[62ch] text-body data-[state=on]:bg-brand"}>
      badge
    </span>
  );
}
