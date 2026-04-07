{
  description = "Development shell for the Obsidian simple plugin monorepo";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = [ ];

          shellHook = ''
            export PATH="$PWD/bin:$PATH"
            echo "Helper: obsidian-dev <command>"
          '';
        };
      });
}
