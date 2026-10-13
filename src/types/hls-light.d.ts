// hls.js ships the "light" build (no subtitles/DRM — not needed here, and
// smaller) without its own typing entry; it has the same API as the full build.
declare module "hls.js/light" {
  import Hls from "hls.js";
  export default Hls;
}
