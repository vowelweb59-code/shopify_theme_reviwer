import { handle, readBody, strList } from "@/lib/service/api/http";
import { fillReviewsFromPosts } from "@/lib/service/chat/fill-reviews";

// Owner action from the Closed view. Without `apply` it only reports; with `apply` and `ids` it writes the ratings of those projects.
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readBody(request);
    return fillReviewsFromPosts({ apply: body.apply === true, ids: body.apply === true ? strList(body.ids, "ids", { max: 400, each: 64 }) : [] });
  });
}
