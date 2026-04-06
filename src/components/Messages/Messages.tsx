import { useState, useRef, useEffect } from "react";
import { API_URL } from "@/config";
import UserIcon from "@/assets/user.svg?react";
import "./Messages.scss";
import type { Message } from "@/types";

interface Props {
  msgList: Message[];
  handleSandMsg: (msg: string) => void;
  isCanvasLoading: boolean;
}

interface ListProps {
  msgList: Message[];
}

function MessagesList(props: ListProps) {
  let prevMsgUser = '';
  let prevMsgMinute = -1;

  const list = props.msgList.map((msg: Message, index: number) => {
    const msgMinute = Math.floor(new Date(msg.createdAt).getTime() / 60000);
    const isSameUserMessage = prevMsgUser === msg.user.name && msgMinute === prevMsgMinute;

    const item = <div className={`messages-item d-flex align-items-start ${isSameUserMessage ? 'same-user' : ''}`} 
      key={index}>
      { !isSameUserMessage &&
      <div className="photo me-3">
        {
          msg.user.photo ? (
            <img className="w-100 rounded-circle h-100" src={`${API_URL}/guessai_canvas/user_photo/${msg.user.photo}/`} />
          ) : (
            <UserIcon className="icon" />
          )
        }
      </div>
      }
      <div className="text">
        <p className="name mb-0">{msg.user.name}
          <span className="time">
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </p>
        <p className={`message mb-0 ${msg.isCorrect ? 'correct' : ''}`}>
          {msg.message}
        </p>
      </div>
    </div>;

    prevMsgUser = msg.user.name;
    prevMsgMinute = msgMinute;

    return item;
  })
  return (
    <>
      {list}
    </>
  );
}

function Messages(props: Props) {
  const messagesContentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);
  const [msgValue, setMsgValue] = useState<string>('');

  const handleSendMsg = (value = msgValue) => {
    const trimmedValue = value.trim();
    if (props.isCanvasLoading) return;
    if (!trimmedValue) return;
    props.handleSandMsg(trimmedValue);
    setMsgValue('');
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  useEffect(() => {
    const messagesContentElement = messagesContentRef.current;
    if (messagesContentElement) {
      messagesContentElement.scrollTop = messagesContentElement.scrollHeight;
    }
  }, [props.msgList]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    if (e.nativeEvent.isComposing || isComposingRef.current) return;
    e.preventDefault();
    handleSendMsg(e.currentTarget.value);
  };

  return (
    <div className="messages">
      <div className="messages-container w-100">
        <div className="messages-wrap overflow-hidden flex-grow-1 d-flex">
          <div className="messages-content" ref={messagesContentRef}>
            <MessagesList msgList={props.msgList} />
          </div>
        </div>
        <div className="messages-input w-100">
          <input
            ref={inputRef}
            type="text"
            className="form-control"
            placeholder={props.isCanvasLoading ? "Waiting for the next canvas..." : "Please guess what the AI drew..."}
            value={msgValue}
            disabled={props.isCanvasLoading}
            onChange={(e) => setMsgValue(e.target.value)}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            onKeyDown={handleKeyDown}
          />
          <button type="button" className="send-btn btn btn-primary" disabled={props.isCanvasLoading} onClick={() => handleSendMsg()}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default Messages;
