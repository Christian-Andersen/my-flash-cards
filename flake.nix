{
  description = "Static flashcard app with build-time syntax highlighting";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = nixpkgs.legacyPackages.${system};

        # Everything the Justfile recipes invoke: npm via nodejs, plus the task
        # runner and the hook runner. `rm` and `bash` come from stdenv.
        devTools = with pkgs; [nodejs_24 just prek];
      in {
        devShells = {
          default = pkgs.mkShell {
            packages = devTools;
          };

          # The Cloudflare Pages deploy in .forgejo/workflows/ci.yml. Split out
          # so `nix develop` stays lean; wrangler is only needed in CI, and
          # pinning it here is what makes the deploy reproducible rather than
          # resolving whatever `npx` happens to fetch at run time.
          deploy = pkgs.mkShell {
            packages = devTools ++ [pkgs.wrangler];
          };
        };
      }
    );
}
