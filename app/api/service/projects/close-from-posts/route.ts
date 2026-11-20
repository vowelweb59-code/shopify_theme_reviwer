import { handle, readBody, strList } from "@/lib/service/api/http";
import { closeHeldFromEndedPosts } from "@/lib/service/chat/close-held";

// Owner action from the On hold view. Without `apply` it only reports; with `apply` and `ids` it completes those held projects.
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readBody(request);
    return closeHeldFromEndedPosts({ apply: body.apply === true, ids: body.apply === true ? strList(body.ids, "ids", { max: 200, each: 64 }) : [] });
  });
}
