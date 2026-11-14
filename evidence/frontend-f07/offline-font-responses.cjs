// Local-font compilation fixture; not production font/typography verification.
module.exports = new Proxy({}, { get: () => "@font-face { font-family: 'OfflineMock'; src: local('Arial'); font-weight: 100 900; font-style: normal; font-display: swap; }" });
