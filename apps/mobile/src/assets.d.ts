/** Bundled audio files resolve to a Metro asset id, like images. */
declare module '*.wav' {
  const asset: number;
  export default asset;
}
