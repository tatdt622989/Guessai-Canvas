import { useState, forwardRef, useEffect, useRef } from "react";
import { socket } from "@/socket";
import { API_URL } from "@/config";
import "./Canvas.scss";

interface Props {
	// TODO
}

interface CanvasRes {
  status: string;
}

const Canvas = forwardRef<HTMLDivElement, Props>((_props, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    function onCanvasReceive(data: CanvasRes) {
      if (!data) return;
      if (data.status) {
        setStatus(data.status);
      }
    }
    socket.on("server canvas", onCanvasReceive);
    return () => {
      socket.off("server canvas", onCanvasReceive);
    };
  }, []);

  useEffect(() => {
    if (!status) return;
    const iframeElement = iframeRef.current;
    if (!iframeElement) return;
    const iframeWindow = iframeElement.contentWindow;
    if (!iframeWindow) return;
    iframeWindow.location.reload();
  }, [iframeRef, status]);

  return (
    <div className="canvas w-100" ref={ref}>
      <div className="canvas-container">
        <iframe src={`${API_URL}/guessai_canvas/canvas/`} ref={iframeRef}></iframe>
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
