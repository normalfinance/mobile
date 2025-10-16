import { JSX as TamaguiJSX } from "tamagui";

declare global {
  namespace JSX {
    interface IntrinsicElements extends TamaguiJSX.IntrinsicElements {}
  }
}
