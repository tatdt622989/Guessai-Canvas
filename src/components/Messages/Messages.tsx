import { useState, useRef, useEffect } from "react";
import { API_URL } from "@/config";
import UserIcon from "@/assets/user.svg?react";
import "./Messages.scss";
import type { Message } from "@/types";

interface Props {
  msgList: Message[];
  handleSandMsg: (msg: string) => void;
}

interface ListProps {
  msgList: Message[];
}

function MessagesList(props: ListProps) {
  let prevMsgUser = '';
  let prevMsgMinute = 0;

  const list = props.msgList.map((msg: Message, index: number) => {
    const item = <div className={`messages-item d-flex align-items-start ${prevMsgUser === msg.user.name && new Date(msg.createdAt).getMinutes() === prevMsgMinute ? 'same-user' : ''}`} 
      key={index}>
      { (prevMsgUser !== msg.user.name || (prevMsgUser === msg.user.name && new Date(msg.createdAt).getMinutes() !== prevMsgMinute)) &&
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
    prevMsgMinute = new Date(msg.createdAt).getMinutes();

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
  const [msgValue, setMsgValue] = useState<string>('');

  const handleSendMsg = () => {
    if (!msgValue) return;
    props.handleSandMsg(msgValue);
    setMsgValue('');
  }

  useEffect(() => {
    const messagesContentElement = messagesContentRef.current;
    if (messagesContentElement) {
      messagesContentElement.scrollTop = messagesContentElement.scrollHeight;
    }
  }, [props.msgList]);

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
            type="text"
            className="form-control"
            placeholder="Please guess what the AI drew..."
            value={msgValue}
            onChange={(e) => setMsgValue(e.target.value)}
            onKeyUp={(e) => {
              if (e.key === "Enter") {
                handleSendMsg();
              }
            }}
          />
          <button className="send-btn btn btn-primary" onClick={handleSendMsg}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default Messages;
