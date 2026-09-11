{
  description = "hana-theme-for-dsh — a HanaAgent-style (paper-and-ink) theme for DeepSeek Harness, plus its development shell";

  # Tracks the NixOS 26.05 release branch; `flake.lock` pins the exact revision.
  #
  # The lock currently points at the SAME nixpkgs revision this host is built
  # from (rev 5dfba62, 2026-08-31), which is deliberate: `nix develop` then
  # resolves to store paths that already exist on the machine, so the dev shell
  # downloads nothing and its Node is byte-identical to the one NixOS ships.
  # Locking the branch tip instead would pull a slightly newer nixpkgs (and a
  # ~50 MB source download) for no benefit a dev shell can use.
  #
  # Move it forward — to a newer 26.05 revision, or to whatever channel the
  # machine has been upgraded to — with
  #
  #   nix flake update nixpkgs
  #
  # or, to re-align with the host after a system upgrade:
  #
  #   nix flake lock --override-input nixpkgs \
  #     "github:NixOS/nixpkgs/$(nixos-version | cut -d. -f4)"
  #
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs =
    {
      self,
      nixpkgs,
    }:
    let
      inherit (nixpkgs) lib;

      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = f: lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system} system);

      # Node 24 is what the harness itself runs on, so the tests exercise the
      # same runtime semantics the plugin will meet in the browser host.
      nodejs = pkgs: pkgs.nodejs_24;

      # Only the files that make up the plugin. Without this the whole working
      # tree — including the multi-megabyte `.research/` reference clones — would
      # be copied into the Nix store on every evaluation.
      src =
        pkgs:
        lib.fileset.toSource {
          root = ./.;
          fileset = lib.fileset.unions [
            ./package.json
            ./cordis.patch.yml
            ./skin.json
            ./README.md
            ./README.zh.md
            ./LICENSE
            ./docs
            ./lib
            ./test
            ./tools
          ];
        };

      # The checks are the release gate: `nix flake check` runs exactly what
      # `npm test` runs, in a sandbox with no network and a read-only source, so
      # a test that only passes because it wrote something will fail here.
      #
      # Every command here is offline by construction. `derive-shiki.mjs --check`
      # qualifies because the repainted source palette is part of the
      # reproduction, not read out of an installed harness. `derive-ink-ramp.mjs
      # --check` qualifies for the same reason: the ramp is recomputed from two
      # anchors already in lib/client.js, so nothing is read from the machine.
      # `selftest.js` needs to spawn a child process; if that is ever forbidden
      # it exits 2 with a message saying so, rather than reporting a mutation as
      # caught.
      checkCommands = ''
        node test/check.js
        node test/tokens.test.js
        node test/surfaces.test.js
        node test/contrast.test.js
        node tools/derive-shiki.mjs --check
        node tools/derive-ink-ramp.mjs --check
        node test/runtime.test.js
        node test/selftest.js
      '';
    in
    {
      devShells = forAllSystems (
        pkgs: _: {
          default = pkgs.mkShell {
            name = "hana-theme-for-dsh";

            packages = [
              (nodejs pkgs)
              pkgs.pnpm
              pkgs.git # `dsh plugin add <git-url>` and flake operations
              pkgs.jq # pretty-printing the Phase 0 DOM probe result
            ];

            # PNPM_HOME does double duty and both halves are wanted: it is the
            # global bin directory, and pnpm 11.21 also roots its
            # content-addressable store underneath it — verified by
            # `pnpm store path`, which reports $PWD/.pnpm/store/v11 with this
            # set and ~/.local/share/pnpm/store/v11 without it. So the store
            # stays inside the working tree and `git clean -xdf` wipes the whole
            # toolchain. A `store-dir` line in .npmrc does NOT work here
            # (`pnpm config get store-dir` stays undefined), which is why there
            # is no .npmrc in this repo.
            #
            # That second half is also a hazard, because the variable is
            # inherited by every child process. `dsh plugin add` runs pnpm, and
            # pnpm records the store it used in the target profile's
            # node_modules/.modules.yaml — so running the install command below
            # from THIS shell writes a store path under this checkout into
            # ~/.dsh/profiles/<name>. pnpm 11 then refuses every later install
            # and update in that profile (ERR_PNPM_UNEXPECTED_STORE, and
            # [ERR_SQLITE_ERROR] once the store directory is gone), which is the
            # one failure the market cannot repair from inside the app. The
            # `dsh` wrapper below strips the variable at that boundary again;
            # see §0.3 E21.
            shellHook = ''
              export PNPM_HOME="$PWD/.pnpm"
              export PATH="$PNPM_HOME:$PATH"

              # `dsh plugin add <abs-path>` links this checkout into a profile;
              # DSH_HOME is where those profiles live.
              export DSH_HOME="''${DSH_HOME:-$HOME/.dsh}"

              # pnpm must never see PNPM_HOME when dsh is the one driving it.
              # `type -P` looks past this function to the real executable.
              dsh() {
                local dsh_bin
                dsh_bin=$(type -P dsh) || dsh_bin=
                if [ -n "$dsh_bin" ]; then
                  env -u PNPM_HOME "$dsh_bin" "$@"
                else
                  printf 'dsh: not found on PATH\n' >&2
                  return 127
                fi
              }

              cat <<'BANNER'
              ── hana-theme-for-dsh ─────────────────────────────────────────────
              BANNER
              printf '  node %s   pnpm %s\n' "$(node --version)" "$(pnpm --version)"
              cat <<'BANNER'

                npm test                    static + allow-list + colour surfaces + contrast
                npm run allowlist:check     is the committed allow-list still fresh?
                npm run refresh:allowlist   re-derive the token allow-list from DSH
                npm run surfaces:check      is the committed colour-surface ledger still fresh?
                npm run refresh:surfaces    re-scan DSH for colour-carrying custom properties
                npm run derive:shiki        re-derive the syntax-highlighting palettes
                npm run derive:ink          re-derive the ink ramp from its two anchors
                npm run probe               print the Phase 0 DOM probe script

                dsh plugin --profile web add "link:$PWD"    install (desktop is app-owned)
                dsh plugin --profile web remove hana-theme-for-dsh

                the dsh wrapper above drops PNPM_HOME, so the profile keeps the
                global pnpm store instead of one inside this checkout (§0.3 E21)
              ───────────────────────────────────────────────────────────────────
              BANNER
            '';
          };
        }
      );

      packages = forAllSystems (
        pkgs: _:
        let
          package = pkgs.stdenv.mkDerivation (finalAttrs: {
            pname = "hana-theme-for-dsh";
            version = (lib.importJSON ./package.json).version;

            src = src pkgs;

            # The client half is a `window.__ModuleLoader__.load(...)` factory
            # with no build step, so there is nothing to compile: the source in
            # `lib/` is the shipped artifact.
            dontBuild = true;

            installPhase = ''
              runHook preInstall
              mkdir -p $out
              cp -r lib test tools cordis.patch.yml skin.json package.json README.md LICENSE $out/
              runHook postInstall
            '';

            meta = {
              description = "HanaAgent-style paper-and-ink theme for DeepSeek Harness";
              license = lib.licenses.mit;
              platforms = lib.platforms.unix;
            };
          });
        in
        {
          default = package;
          hana-theme-for-dsh = package;
        }
      );

      checks = forAllSystems (
        pkgs: _: {
          tests =
            pkgs.runCommandLocal "hana-theme-for-dsh-checks" { nativeBuildInputs = [ (nodejs pkgs) ]; }
              ''
                cp -r ${src pkgs} source
                chmod -R u+w source
                cd source
                ${checkCommands}
                touch $out
              '';

          # NOTE — there is deliberately no "allow-list is fresh" check here.
          #
          # Regenerating the allow-list requires an INSTALLED DeepSeek Harness to
          # read the palette out of, and a Nix build sandbox only exposes the
          # derivation's own closure in /nix/store, so no dsh-* path exists to
          # find. The check runs where a harness actually is:
          #
          #   npm run allowlist:check
          #
          # which fails the build if test/token-allowlist.json no longer matches
          # the installed ui-theme. Keeping it out of `nix flake check` is a
          # statement about what a pure build can know, not an omission.
        }
      );

      apps = forAllSystems (
        pkgs: _: {
          refresh-allowlist = {
            type = "app";
            meta = {
              description = "Re-derive test/token-allowlist.json from the installed DeepSeek Harness";
              maintainers = [ ];
            };
            program = "${
              pkgs.writeShellApplication {
                name = "refresh-allowlist";
                runtimeInputs = [ (nodejs pkgs) ];
                text = ''exec node ${./tools/refresh-allowlist.mjs} "$@"'';
              }
            }/bin/refresh-allowlist";
          };
          default = self.apps.${pkgs.stdenv.hostPlatform.system}.refresh-allowlist;
        }
      );

      formatter = forAllSystems (pkgs: _: pkgs.nixfmt);
    };
}
