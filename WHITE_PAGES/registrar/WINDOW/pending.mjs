// Which open PRs are joins still on the rail. A join is recognised by its diff:
// it ADDS a WHITE_PAGES/<handle>/ADDRESS.md, whatever its title says (POS-630:
// postmark#3804, titled "address: joins", added jiya's address and the board
// listed nothing). Joins target main: a PR into a train (a "train takes main",
// or a lane branched from main) carries joins main already settled, so the diff
// counts only for a PR whose base is main. The words decide only for a PR whose
// file list couldn't be read.
const ADDRESS = /^WHITE_PAGES\/[^/]+\/ADDRESS\.md$/;
const WORDS = /address:\s+.+\s+joins|asks for an address in the town|asks for an address/i;

// An entry without a changeType (an older gh) counts as added when this
// checkout has no address at that path.
export const addsAnAddress = (files, hasAddress = () => false) =>
  files.some(f => ADDRESS.test(f.path) && (f.changeType ? f.changeType === "ADDED" : !hasAddress(f.path)));

export const isJoin = (pr, hasAddress) => Array.isArray(pr.files)
  ? pr.baseRefName === "main" && addsAnAddress(pr.files, hasAddress)
  : WORDS.test(`${pr.title}\n${pr.body || ""}`);

export const pendingJoins = (open, hasAddress) => open.filter(pr => isJoin(pr, hasAddress))
  .map(pr => ({ number:pr.number, title:pr.title, url:pr.url }));
