# Publishing checklist — V2.32

**Author/Maintainer:** Jens Kowalsky

- [ ] Run `python tools/run_tests.py`.
- [ ] Run `python tools/neutrality_check.py`.
- [ ] Build both editions with `python tools/build_xpi.py --all`.
- [ ] Verify manifest version is `2.0.32` in both builds.
- [ ] Verify author is `Jens Kowalsky` in both manifests.
- [ ] Verify public add-on ID is `m365-calendar@jenskowalsky.invalid`.
- [ ] Verify STANDARD contains no `experiment_apis` and no `experiments/` payload.
- [ ] Verify NATIVE includes the native calendar Experiment API.
- [ ] Verify public `clientId` and `tenant` defaults are empty.
- [ ] Confirm DE/EN user/admin guides are present.
- [ ] Install-test STANDARD in Thunderbird.
- [ ] Install-test NATIVE in Thunderbird.
- [ ] NATIVE: confirm provider diagnostics show loaded/registered after a restart.
- [ ] NATIVE: confirm a known Exchange event shows the correct local time after sync.
- [ ] NATIVE: test `W. Europe Standard Time` and another time-zone selection.
- [ ] NATIVE: test attendee autocomplete against a real CardDAV address book and inspect `addressBookAsync*` diagnostics.
- [ ] NATIVE: confirm calendar colour/hide/disable preferences survive restart.
- [ ] NATIVE: confirm Teams meeting toolbar/context actions and native M365 double-click editor.
- [ ] Confirm monitor-safe popup scrolling and always-visible action footer.
- [ ] Record SHA-256 hashes for release artifacts.

## GitHub discoverability

- [ ] Set the repository description from `GITHUB_REPOSITORY_SETTINGS.md`.
- [ ] Add the recommended GitHub topics (`thunderbird`, `microsoft-365`, `exchange-online`, `teams`, etc.).
- [ ] Keep the 3-5 Power Electronics reference factual and contextual; do not describe this repository as an official company product.
- [ ] Do not use `3-5pe.com` as the repository homepage unless the company explicitly hosts or officially supports the project.
