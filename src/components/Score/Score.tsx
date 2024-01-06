import { useState } from "react";
import "./Score.scss";

interface Props {
	position?: string;
}

function Score(props: Props) {
  return (
    <div className={`score ${props.position ? props.position : ''}`}>
      <div className="score-container">
        <div className="score-content">
          <div className="score-title">Your Score</div>
          <div className="score-value">9999</div>
        </div>
      </div>
    </div>
  );
}

export default Score;
