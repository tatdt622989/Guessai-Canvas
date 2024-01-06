import { useState, forwardRef } from "react";
import "./Canvas.scss";

interface Props {
	// TODO
}

const Canvas = forwardRef<HTMLDivElement, Props>((props, ref) => {
  return (
    <div className="canvas w-100" ref={ref}>
      <div className="canvas-container">
        <div className="default">
          <div className="bg"></div>
          <p className="text mb-0">
            <span>L</span>
            <span>o</span>
            <span>a</span>
            <span>d</span>
            <span>i</span>
            <span>n</span>
            <span>g</span>
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </p>
        </div>
      </div>
    </div>
  );
});

export default Canvas;
