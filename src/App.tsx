import { useState, useRef, useEffect } from "react";
import { socket } from "./socket";
import Header from "./components/Header/Header.tsx";
import Canvas from "./components/Canvas/Canvas.tsx";
import Messages from "./components/Messages/Messages.tsx";
import Ranking from "./components/Ranking/Ranking.tsx";
import Score from "./components/Score/Score.tsx";
import SignUpModal from "./components/Modal/SignUpModal.tsx";
import CorrectModal from "./components/Modal/CorrectModal.tsx";
import { useDispatch } from "react-redux";
import { fetchUser } from "@/store/UserSlice.ts";
import "./App.css";

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();

  useEffect(() => {
    // get user data
    dispatch(fetchUser());
  }, [dispatch]);

  // get canvas height
  useEffect(() => {
    function handleResize() {
      const canvasWrapElement = canvasWrapRef.current;
      if (canvasWrapElement) {
        setCanvasHeight(canvasWrapElement.clientHeight);
      }
    }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [canvasWrapRef]);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }
    function onDisconnect() {
      setIsConnected(false);
    }
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    // error handling
    socket.on("connect_error", (err) => {
      console.log(err);
    });

    socket.connect();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return (
    <div className="app container">
      <div className="row">
        <Header />
        <div className="col-12 col-lg-8">
          <Score position={"mobile"} />
          <Canvas ref={canvasWrapRef} />
          <Messages />
        </div>
        <div className="col-12 col-lg-4 d-flex flex-column">
          <Score />
          <Ranking canvasHeight={canvasHeight} />
        </div>
        <div className="footer w-100 d-flex align-items-center justify-content-start py-4 flex-column flex-md-row">
          <div className="copyright">
            © {new Date().getFullYear()}
            <a href="https://6yuwei.com" target="_blank">
              6yuwei
            </a>
            . All Rights Reserved.
          </div>
          <div className="connect-status ms-0 ms-md-auto">
            <p className="mb-0">
              State: {isConnected ? "Connected" : "Disconnected"}
            </p>
          </div>
        </div>
      </div>
      <SignUpModal />
      <CorrectModal />
    </div>
  );
}

export default App;
