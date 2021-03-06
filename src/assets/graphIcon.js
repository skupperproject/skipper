import React from "react";

export const GraphIcon = ({
  width = "28",
  height = "20",
  className = "sk-icon-graph",
  scale = 1.0,
  id = "Graph",
}) => {
  const sscale = `scale(${scale})`;
  return (
    <svg
      version="1.1"
      width={width}
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      id={id}
    >
      <g transform={sscale}>
        <g id="bezier-path" transform="translate(11, 9)">
          <path d="M0,0 L 6,6" />
          <path d="M0,0 L 6,-6" />
        </g>
        <g id="service">
          <rect x="1" y="6" rx="2" width="10" height="6" />
        </g>
        <use href="#service" transform="translate(15,-5)" />
        <use href="#service" transform="translate(15,5)" />
      </g>
    </svg>
  );
};
