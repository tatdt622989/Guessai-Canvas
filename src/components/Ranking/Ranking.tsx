import { useState, useMemo } from "react";
import "./Ranking.scss";
import Star from "@/assets/star.svg?react";
import Hexagon from "@/assets/hexagon.svg?react";
import UserIcon from "@/assets/user.svg?react";

interface Prop {
	canvasHeight: number;
}

function RankingList() {
	const items = useMemo(() => {
		const arr = [];
		for(let i = 0; i < 10; i++) {
			arr.push(<div className="ranking-item d-flex align-items-center position-relative" key={i}>
				<div className="ranking-no d-flex justify-content-center align-items-center me-2">
					<Hexagon />
					<span className="number">{i + 1}</span>
				</div>
				<div className="ranking-item-photo d-block me-2">
					{/* <img src="" alt="" /> */}
					<UserIcon className="icon" />
				</div>
				<div className="ranking-item-name">6yuwei</div>
				<div className="ranking-item-score">9999</div>
			</div>);
		}
		return arr;
	}
	, []);

	return (
		<div className="ranking-list">
			{items}
		</div>
	);
}

function Ranking(props: Prop) {
	const height = useMemo(() => {
		return props.canvasHeight + 273;
	}, [props.canvasHeight]);

  return (
    <div className="ranking overflow-hidden" style={{ maxHeight: height }}>
      <div className="ranking-container overflow-auto position-relative" style={{ maxHeight: height }}>
        <div className="ranking-head d-flex justify-content-start align-items-center position-sticky top-0">
          <Star />
          <div className="ranking-title">Ranking</div>
        </div>
        <RankingList />
      </div>
    </div>
  );
}

export default Ranking;
