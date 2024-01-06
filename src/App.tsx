import { useState, useRef, useEffect } from "react";
import Header from "./components/Header/Header.tsx";
import Canvas from "./components/Canvas/Canvas.tsx";
import Messages from "./components/Messages/Messages.tsx";
import Ranking from "./components/Ranking/Ranking.tsx";
import Score from "./components/Score/Score.tsx";
import "./App.css";

function App() {
  const [count, setCount] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  // get canvas height
  useEffect(() => {
    function handleResize() {
      const canvasWrapElement = canvasWrapRef.current;
      if (canvasWrapElement) {
        setCanvasHeight(canvasWrapElement.clientHeight);
      }
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => {
      window.removeEventListener('resize', handleResize);
    }
  }, [canvasWrapRef]);

  return (
    <div className="app container">
      <div className="row">
        <Header />
        <div className="col-12 col-lg-8">
          <Score position={'mobile'} />
          <Canvas ref={canvasWrapRef} />
          <Messages />
        </div>
        <div className="col-12 col-lg-4 d-flex flex-column">
          <Score />
          <Ranking canvasHeight={canvasHeight} />
        </div>
        <div className="copyright w-100 d-flex align-items-center justify-content-start py-4">
          © {new Date().getFullYear()}
          <a href="https://6yuwei.com" target="_blank">6yuwei</a>.
           All Rights Reserved.
        </div>
      </div>
    </div>
  );
}

export default App;
