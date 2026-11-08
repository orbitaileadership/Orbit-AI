// Next's documented-in-source test hook; used only by offline candidate builds.
// These placeholder assets are compile fixtures, never production font files.
module.exports = new Proxy({}, {
  get(_target, url) {
    if (typeof url !== 'string' || !url.startsWith('https://fonts.googleapis.com/')) return undefined;
    const family = new URL(url).searchParams.get('family')?.split(':')[0];
    if (!family || !/^[A-Za-z0-9 _-]+$/.test(family)) return undefined;
    return `@font-face { font-family: '${family}'; font-style: normal; font-weight: 100 900; src: url(https://fonts.gstatic.com/offline-test.woff2) format('woff2'); }`;
  },
});
