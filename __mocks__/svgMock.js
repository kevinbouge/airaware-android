const React = require('react');
const { Svg } = require('react-native-svg');

function SvgMock(props) {
  return React.createElement(Svg, props);
}

module.exports = SvgMock;
module.exports.default = SvgMock;
