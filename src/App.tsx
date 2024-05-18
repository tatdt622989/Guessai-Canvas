import { useState, useRef, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAppDispatch } from '@/store/store.ts';
import { fetchUser } from "@/store/UserSlice.ts";
import { addToast, removeToast } from "./components/Toast/ToastSlice.ts";
import { socket } from "./socket";
import "./App.css";
import { API_URL, ROOT_PATH } from "@/config";
import Header from "./components/Header/Header.tsx";
import Home from "./pages/Home/Home.tsx";
import Gallery from "./pages/Gallery/Gallery.tsx";
import SignUpModal from "./components/Modal/SignUpModal.tsx";
import CorrectModal from "./components/Modal/CorrectModal.tsx";
import Toast from "./components/Toast/Toast.tsx";
import type { Message } from '@/types';

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [msgList, setMsgList] = useState<Message[]>([]);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();

  const getMsgList = () => {
    fetch(`${API_URL}/guessai_canvas/msg_list/`)
      .then((res) => res.json())
      .then((data) => {
        setMsgList(data);
      });
  };

  const handleSandMsg = (msg: string) => {
      socket.emit("client message", msg);
  };

  const handleResize = () => {
    const canvasWrapElement = canvasWrapRef.current;
    if (canvasWrapElement) {
      setCanvasHeight(canvasWrapElement.clientHeight);
    }
  };

  useEffect(() => {
    // get user data
    dispatch(fetchUser());
    // detect user visibility
    const handleVisibilityChange = () => {
      if (document.hidden) {
        socket.disconnect();
      } else {
        window.location.reload();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  }, [dispatch]);

  // get canvas height
  useEffect(() => {
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [canvasWrapRef]);

  useEffect(() => {
    getMsgList();
  
    function onConnect() {
      setIsConnected(true);
    }
    function onDisconnect() {
      setIsConnected(false);
    }
    function onMsgReceive(msg: Message) {
      if (!msg) return;
      if (msg.status === "error") {
        const toastID = Date.now();
        dispatch(addToast({
          id: toastID,
          type: "error",
          description: msg.message,
        }));
        setTimeout(() => {
          dispatch(removeToast(toastID));
        }, 6000);
        return;
      }
      setMsgList((prev) => [...prev, msg]);
      // update user score
      if (msg.isCorrect) {
        dispatch(fetchUser());
      }
    }
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("server message", onMsgReceive);

    // error handling
    socket.on("connect_error", (err) => {
      console.log(err);
    });

    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("server message", onMsgReceive);
    };
  }, [dispatch]);

  return (
    <Router basename={ROOT_PATH}>
      <div className="app container">
        <div className="row">
          <Header handleResize={handleResize} />
          <Routes>
            <Route path="/" element={
            <Home
              canvasHeight={canvasHeight}
              msgList={msgList}
              handleSandMsg={handleSandMsg}
              ref={canvasWrapRef}
            />
            } />
            <Route path="gallery/:page" element={<Gallery />} />
            <Route path="*" element={
              <Home
                canvasHeight={canvasHeight}
                msgList={msgList}
                handleSandMsg={handleSandMsg}
                ref={canvasWrapRef}
              />
            } />
          </Routes>
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
        <Toast />
      </div>
    </Router>
  );
}

export default App;
