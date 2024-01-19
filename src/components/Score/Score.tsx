import { useAppSelector } from "@/store/store";
import "./Score.scss";

interface Props {
	position?: string;
}

function Score(props: Props) {
  const score = useAppSelector((state) => state.user.score);

  return (
    <div className={`score ${props.position ? props.position : ''}`}>
      <div className="score-container">
        <div className="score-content">
          <div className="score-title">Your Score</div>
          <div className="score-value">{score}</div>
        </div>
      </div>
    </div>
  );
}

export default Score;
