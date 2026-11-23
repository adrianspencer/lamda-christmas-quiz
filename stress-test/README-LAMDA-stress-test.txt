LAMDA CHRISTMAS QUIZ — 20-CONTESTANT STRESS TEST

WHAT IT DOES
- Opens up to 20 separate Chrome tabs, each with its own contestant session.
- Enters distinct names (Stress Test 01 … Stress Test 20).
- Clicks the real ENTER THE QUIZ and JOIN QUIZ buttons.
- Waits for the quizmaster to start the quiz.
- Whenever a question is open, types and submits one clearly-labelled dummy answer
  for each contestant automatically.
- Leaves the host in control of starting, revealing, marking, advancing and finishing.
- Does NOT reset the quiz or delete players.

REQUIREMENTS
- macOS with Google Chrome installed.
- Node.js installed.
- Internet access to the quiz deployment.

ONE-TIME SETUP (Terminal)
1. Put lamda-stress-test.js in a folder, then open Terminal in that folder.
2. Run:
     npm init -y
     npm install playwright
3. Run the test against the DEV URL:
     node lamda-stress-test.js https://test-results.lamda-christmas-quiz.pages.dev/

RUN
- Keep the Terminal window open.
- The script opens 20 contestant tabs and joins them.
- Check the host lobby: it should show 20 players.
- Start the quiz from the host page as normal.
- The script submits a dummy answer for every contestant on each question.
- You still operate the host controls to reveal, mark, and advance questions.
- Ctrl+C in Terminal stops the automation. It does not reset the quiz.

OPTIONS
Use fewer contestants for a smaller test:
  PLAYERS=5 node lamda-stress-test.js https://test-results.lamda-christmas-quiz.pages.dev/

Change the visible test-name prefix:
  NAME_PREFIX="Load Test" node lamda-stress-test.js https://test-results.lamda-christmas-quiz.pages.dev/

IMPORTANT
Run this against the DEV deployment, not the public event link. The script creates
real lobby participants and submits dummy answers. When finished, use the normal
host RESET QUIZ & CLEAR PLAYERS control if you want to clear the test game.
