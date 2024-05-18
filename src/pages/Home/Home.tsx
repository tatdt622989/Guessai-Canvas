import { forwardRef } from "react";
import Canvas from "@/components/Canvas/Canvas.tsx";
import Messages from "@/components/Messages/Messages.tsx";
import Ranking from "@/components/Ranking/Ranking.tsx";
import Score from "@/components/Score/Score.tsx";
import type { Message } from '@/types';

interface Props {
  canvasHeight: number;
  msgList: Message[];
  handleSandMsg: (msg: string) => void;
}

const Home = forwardRef<HTMLDivElement, Props>((_props, ref) => {
  return (
    <>
      <div className="col-12 col-lg-8">
        <Score position={"mobile"} />
        <Canvas ref={ref} />
        <Messages msgList={_props.msgList} handleSandMsg={_props.handleSandMsg} />
      </div>
      <div className="col-12 col-lg-4 d-flex flex-column">
        <Score />
        <Ranking canvasHeight={_props.canvasHeight} />
      </div>
    </>
  );
});

export default Home;
