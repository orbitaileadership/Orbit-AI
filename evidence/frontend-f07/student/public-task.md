# F07 student source-passage task — LOCALMOCK

I am a STEM/business undergraduate checking source passages from fictional course notes before using them in a lab worksheet or inventory case.

Use the actual `SourceList` component with `fixtures.json` in the local-only harness. At a desktop viewport width of 1440 px and a phone viewport width of 375 px, open each source excerpt. Check that the selected passage and its full source name are readable within the page, including long filenames and unbroken instrument or stock identifiers. Normal vertical scrolling is allowed.

Use the source controls to switch passages and close/reopen a passage. Inspect the fictional web source and preserve its displayed URL and link attributes, but do not follow it or perform any actual external navigation. Do not upload anything or call a provider, database, website, or audio service.

`synthetic-notes.md` is the fictional source material behind the fixture excerpts. It contains no generated assistant answer. All people, course examples, companies, measurements, identifiers, and references in this packet are synthetic.

The proposed repair is limited to wrapping inside `SourceGroup`. Citation parsing, source selection, focus behavior, and navigation are outside the change scope. This packet does not resume F02 SearchChats/C5, whose held-out result remains failed 2/2.

Baseline: `ec6522390484d11d70437320be7019d44cf1cf21`; branch: `codex/frontend-source-wrap-f07-20261112`. Maximum two F07 repair attempts. Release status remains HOLD. Any local mock usability result must be reported separately from actual quality (70%) and cost (30%), which remain unscored; no overall score is authorized.

Packet prepared; visual/DOM student assessment awaits actual local desktop and phone evidence. No product or harness files were changed by the student tester.
