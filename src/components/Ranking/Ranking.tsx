import { useState, useMemo, useEffect } from "react";
import "./Ranking.scss";
import API_URL from "@/config";
import Star from "@/assets/star.svg?react";
import Hexagon from "@/assets/hexagon.svg?react";
import UserIcon from "@/assets/user.svg?react";
import type { SimpleUser } from "@/types";
import { socket } from "@/socket";

interface Prop {
	canvasHeight: number;
}

function RankingList() {
	const [rankingList, setRankingList] = useState<SimpleUser[]>([]);

	useEffect(() => {
		fetch(`${API_URL}/guessai_canvas/ranking/`)
		.then((res) => res.json())
		.then((data) => {
			setRankingList(data);
		});

		socket.on("server ranking", (data: SimpleUser[]) => {
			setRankingList(data);
		});
	}, []);

	const items = useMemo(() => {
		const arr = rankingList.map((item, i) => {
			return (item.score ? <div className="ranking-item d-flex align-items-center position-relative" key={i}>
				<div className="ranking-no d-flex justify-content-center align-items-center me-2">
					<Hexagon />
					<span className="number">{i + 1}</span>
				</div>
				<div className="ranking-item-photo d-block me-2">
					{item.photo ? <img src={`${API_URL}/guessai_canvas/user_photo/${item.photo}/`} alt="" className="w-100 object-fit-contain h-100" /> : <UserIcon className="icon" />}
				</div>
				<div className="ranking-item-name">{item.name}</div>
				<div className="ranking-item-score">{item.score}</div>
			</div> : false);
		});
		return arr;
	}
	, [rankingList]);

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
