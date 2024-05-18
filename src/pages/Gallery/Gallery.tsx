import { useState, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAppDispatch } from "@/store/store.ts";
import { addToast, removeToast } from "@/components/Toast/ToastSlice.ts";
import { API_URL } from "@/config";
import type { GuessAICanvas } from "@/types";
import SearchIcon from "@/assets/search.svg?react";
import "./Gallery.scss";

interface GalleryRes {
  canvasList: GuessAICanvas[];
  currentPage: number;
  totalPage: number;
  total: number;
  solvedProbability: number;
}

function GalleryList(props: { canvasList: GuessAICanvas[] }) {
  const list = props.canvasList.map((item) => {
    return (
      <div className="col-xl-3 col-md-6 card-wrap col-sm-12" key={item._id}>
        <div className="card w-100" style={{ width: "18rem" }}>
          <iframe
            className="card-iframe"
            src={
              item._id ? `${API_URL}/guessai_canvas/canvas/${item._id}/` : ""
            }
            frameBorder="0"
          ></iframe>
          <div className="card-body">
            <p className="card-text answer">
              {item.answerTW},{item.answerEN},{item.answerJP}
            </p>
            <p
              className={`card-text ${
                item.correctRespondent ? "solved" : "unsolved"
              }`}
            >
              {item.correctRespondent ? "Solved" : "Unsolved"}
            </p>
          </div>
        </div>
      </div>
    );
  });

  return <>{list}</>;
}

function Gallery() {
  const { page } = useParams<{ page: string }>();
  const currentPage = page ? Number(page) : 1;
  const [totalPage, setTotalPage] = useState(1);
  const [pageGroup, setPageGroup] = useState<number[]>([]);
  const displayPage = totalPage > 5 ? 5 : totalPage;
  const [resData, setResData] = useState<GalleryRes>();
  const [canvasList, setCanvasList] = useState<GuessAICanvas[]>([]);
  const [search, setSearch] = useState<string>("");
  const [keyword, setKeyword] = useState<string>("");
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const getGallery = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_URL}/guessai_canvas/canvas_list/?page=${currentPage}&keyword=${keyword}`,
        {
          method: "GET",
          credentials: "include",
        }
      );
      if (!res) return;
      if (res.status === 404) throw new Error("Page Not Found");
      if (res.status === 500) throw new Error("Server Error");
      const data = (await res.json()) as GalleryRes;
      setResData(data);
      setCanvasList(data.canvasList);
    } catch (err: unknown) {
      console.log(err);
      const toastID = Date.now();
      const errorMsg = err instanceof Error ? err.message : "Server Error";
      dispatch(
        addToast({
          id: toastID,
          type: "error",
          description: errorMsg,
        })
      );
      setTimeout(() => {
        dispatch(removeToast(toastID));
      }, 6000);
      return navigate("/gallery/1");
    }
  }, [currentPage, dispatch, keyword, navigate]);

  useEffect(() => {
    getGallery();
  }, [currentPage, getGallery]);

  useEffect(() => {
    if (!resData) return;

    // get total page
    setTotalPage(resData.totalPage);

    // get display page group
    let start = 1;
    const group = [];
    if (Number(currentPage) > 3) {
      start = Number(currentPage) - 2;
    }
    for (let i = start; i < start + displayPage; i++) {
      if (i > totalPage) break;
      group.push(i);
    }
    if (group.length < displayPage) {
      for (let i = start - 1; i > 0; i--) {
        group.unshift(i);
        if (group.length === displayPage) break;
      }
    }

    setPageGroup(group);
  }, [resData, displayPage, currentPage, totalPage]);

  return (
    <div className="container gallery">
      <div className="row">
        <p className="info text-center">
          Total: <span>{(resData && resData.total) ?? 0} </span>
        </p>
        <p className="info text-center mb-3 mb-md-4">
          Solved Probability:{" "}
          <span>{(resData && resData.solvedProbability) ?? 100}%</span>
        </p>
        <div className="search-box">
          <div className="input-group mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="search..."
              aria-label="search..."
              aria-describedby="button-addon2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => {
                console.log(e.key);
                if (e.key === "Enter") {
                  setKeyword(search);
                }
              }}
            />
            <button
              className="btn btn-outline-secondary"
              type="button"
              id="button-addon2"
              onClick={() => {
                setKeyword(search);
              }}
            >
              <SearchIcon />
            </button>
          </div>
        </div>
        <GalleryList canvasList={canvasList} />
        <nav
          aria-label="Page navigation example"
          className="page mx-auto d-flex justify-content-center"
        >
          <ul className="pagination">
            {pageGroup[0] > 1 ? (
              <li className="page-item">
                <Link
                  className="page-link"
                  to={
                    currentPage - 1 > 1
                      ? `/gallery/${currentPage - 1}`
                      : `/gallery/1`
                  }
                  aria-label="Previous"
                >
                  <span aria-hidden="true">&lt;</span>
                </Link>
              </li>
            ) : (
              false
            )}
            {pageGroup.map((item) => {
              return (
                <li className="page-item" key={item}>
                  <Link
                    className={`page-link ${
                      item === currentPage ? "active" : ""
                    }`}
                    to={`/gallery/${item}`}
                  >
                    {item}
                  </Link>
                </li>
              );
            })}
            {pageGroup.length > 1 &&
            pageGroup[pageGroup.length - 1] < totalPage ? (
              <li className="page-item">
                <Link
                  className="page-link"
                  to={
                    currentPage + 1 < totalPage
                      ? `/gallery/${currentPage + 1}`
                      : `/gallery/${totalPage}`
                  }
                  aria-label="Next"
                >
                  <span aria-hidden="true">&gt;</span>
                </Link>
              </li>
            ) : (
              false
            )}
          </ul>
        </nav>
      </div>
    </div>
  );
}

export default Gallery;
