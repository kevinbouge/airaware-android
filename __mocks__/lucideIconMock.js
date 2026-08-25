const React = require('react');

function LucideIconMock(props) {
  return React.createElement('svg', { ...props, 'data-lucide': 'mock-icon' });
}

LucideIconMock.displayName = 'LucideIconMock';

module.exports = LucideIconMock;
module.exports.default = LucideIconMock;
