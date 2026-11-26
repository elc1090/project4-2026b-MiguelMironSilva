"""Administração local: python -m app.cli --help (run from backend)."""
import argparse
import getpass
import sys
import warnings

from app.database import SessionLocal
from app.services.superusers import (
    SuperuserError,
    create_superuser,
    promote_superuser,
    validate_identity,
)


class _SafeParser(argparse.ArgumentParser):
    def error(self, message):
        self.exit(2, "Argumentos inválidos; consulte --help. Não passe senhas em argumentos.\n")


def _hidden_password(prompt: str) -> str:
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        return getpass.getpass(prompt)


def main(argv: list[str] | None = None) -> int:
    parser = _SafeParser(description="Administração local de superusuários")
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create-superuser", help="Criar uma nova conta administrativa")
    create.add_argument("--username", required=True)
    create.add_argument("--email", required=True)
    promote = commands.add_parser("promote-superuser", help="Promover uma conta existente")
    promote.add_argument("--username", required=True)
    args = parser.parse_args(argv)

    try:
        username, email = validate_identity(args.username, getattr(args, "email", "unused"))
        if args.command == "create-superuser":
            password = _hidden_password("Senha (8–128 caracteres, preservada exatamente): ")
            confirmation = _hidden_password("Confirme a senha: ")
            if password != confirmation:
                raise SuperuserError("As senhas não conferem")
            with SessionLocal() as db:
                create_superuser(db, username, email, password)
            print("Superusuário criado com sucesso")
        else:
            confirmation = input(f"Digite PROMOVER {username} para confirmar: ")
            if confirmation != f"PROMOVER {username}":
                raise SuperuserError("Promoção cancelada: confirmação não recebida")
            with SessionLocal() as db:
                promote_superuser(db, username)
            print("Conta confirmada como superusuário (operação idempotente)")
        return 0
    except (EOFError, KeyboardInterrupt):
        print("Operação cancelada", file=sys.stderr)
    except getpass.GetPassWarning:
        print("Não foi possível ocultar a senha; use um terminal seguro", file=sys.stderr)
    except SuperuserError as exc:
        print(f"Erro: {exc}", file=sys.stderr)
    except Exception:
        # Do not print exception text/tracebacks: DB errors can include hashes/SQL.
        print("Falha na operação; nenhuma informação sensível foi exibida", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
