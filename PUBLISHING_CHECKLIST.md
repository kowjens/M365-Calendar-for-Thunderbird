# Publishing checklist — V2.19

**Author/Maintainer:** Jens Kowalsky

- [ ] Run `python tools/run_tests.py`.
- [ ] Run `python tools/neutrality_check.py`.
- [ ] Build both editions with `python tools/build_xpi.py --all`.
- [ ] Verify manifest version is `2.0.19` in both builds.
- [ ] Verify author is `Jens Kowalsky` in both manifests.
- [ ] Verify public add-on ID is `m365-calendar@jenskowalsky.invalid`.
- [ ] Verify STANDARD contains no `experiment_apis` and no `experiments/` payload.
- [ ] Verify NATIVE includes the native calendar Experiment API.
- [ ] Verify public `clientId` and `tenant` defaults are empty.
- [ ] Confirm DE/EN user/admin guides are present.
- [ ] Install-test STANDARD in Thunderbird.
- [ ] Install-test NATIVE in Thunderbird.
- [ ] NATIVE: confirm automatic sync after Thunderbird restart.
- [ ] NATIVE: confirm calendar hide/show does not duplicate events.
- [ ] NATIVE: confirm Teams meeting toolbar/context actions.
- [ ] NATIVE: confirm native M365 double-click editor.
- [ ] Test attendee autocomplete against a local Thunderbird address book.
- [ ] Confirm monitor-safe popup scrolling and always-visible action footer.
- [ ] Record SHA-256 hashes for release artifacts.

## GitHub discoverability

- [ ] Set the repository description from `GITHUB_REPOSITORY_SETTINGS.md`.
- [ ] Add the recommended GitHub topics (`thunderbird`, `microsoft-365`, `exchange-online`, `teams`, etc.).
- [ ] Keep the 3-5 Power Electronics reference factual and contextual; do not describe this repository as an official company product.
- [ ] Do not use `3-5pe.com` as the repository homepage unless the company explicitly hosts or officially supports the project.
