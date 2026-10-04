import { createContext, useContext, type CSSProperties, type ReactNode } from "react";

/**
 * A named seam in the layout that a 3D renderer can lift out of the page.
 *
 * In the app a Layer is nothing: it renders its children and drops the rest.
 * Flute's demo scenes provide an implementation that wraps each one in a
 * Surface, so the sidebar, sky, header and panels can separate in depth.
 * `className`/`style` size that wrapper; they never touch normal layout.
 */
export type LayerProps = {
  id: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export const LayerContext = createContext<(props: LayerProps) => ReactNode>(
  ({ children }) => children,
);

export function Layer(props: LayerProps) {
  const Impl = useContext(LayerContext);
  return <Impl {...props} />;
}
