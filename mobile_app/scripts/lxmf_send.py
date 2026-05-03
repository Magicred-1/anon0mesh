#!/home/m4gicred1/.local/share/pipx/venvs/lxmf/bin/python3
"""
Minimal LXMF send script with persistent identity.
Usage: ./lxmf_send.py <dest_hex> "message text"

Identity saved to ~/.lxmf_test_id — stable source address across runs.
Requires the destination to have announced (rnsd must have its identity cached).
"""
import sys, os, time, RNS, LXMF

IDENTITY_PATH = os.path.expanduser("~/.lxmf_test_id")
PATH_TIMEOUT  = 15  # seconds to wait for path resolution

def main():
    if len(sys.argv) < 3:
        print("Usage: lxmf_send.py <dest_hex> <message>")
        sys.exit(1)

    dest_hex = sys.argv[1].strip()
    content  = " ".join(sys.argv[2:])
    dest_hash = bytes.fromhex(dest_hex)

    RNS.Reticulum()

    # Load or generate persistent identity
    if os.path.exists(IDENTITY_PATH):
        identity = RNS.Identity.from_file(IDENTITY_PATH)
        print("[identity] loaded")
    else:
        identity = RNS.Identity()
        identity.to_file(IDENTITY_PATH)
        print(f"[identity] generated and saved to {IDENTITY_PATH}")

    # Router creates and registers our lxmf.delivery destination
    router = LXMF.LXMRouter(identity=identity, storagepath="/tmp/lxmf_test")
    router.register_delivery_identity(identity)
    source_dest = next(iter(router.delivery_destinations.values()))

    # Announce our identity so the phone can resolve us for replies
    router.announce(source_dest.hash)
    time.sleep(4)  # give announce time to propagate before message arrives

    print(f"[source  ] {RNS.prettyhexrep(source_dest.hash)}")
    print(f"[dest    ] {dest_hex}")

    # Request path if unknown
    if not RNS.Transport.has_path(dest_hash):
        print("[path    ] unknown — requesting...")
        RNS.Transport.request_path(dest_hash)
        deadline = time.time() + PATH_TIMEOUT
        while not RNS.Transport.has_path(dest_hash) and time.time() < deadline:
            time.sleep(0.5)

    if not RNS.Transport.has_path(dest_hash):
        print("[error   ] no path found — is phone connected to rnsd and has it announced?")
        sys.exit(1)

    # Recall the destination identity (populated by the phone's announce)
    dest_identity = RNS.Identity.recall(dest_hash)
    if dest_identity is None:
        print("[error   ] identity not cached — wait for phone to announce, then retry")
        sys.exit(1)

    target = RNS.Destination(
        dest_identity, RNS.Destination.OUT, RNS.Destination.SINGLE,
        "lxmf", "delivery",
    )

    msg = LXMF.LXMessage(
        target, source_dest, content,
        title="", desired_method=LXMF.LXMessage.DIRECT,
    )
    msg.try_propagation_on_fail = False

    print(f"[sending ] {content!r}")
    router.handle_outbound(msg)

    deadline = time.time() + 15
    while time.time() < deadline:
        if msg.state == LXMF.LXMessage.DELIVERED:
            print("[done    ] delivered")
            return
        if msg.state == LXMF.LXMessage.FAILED:
            print("[done    ] failed")
            return
        time.sleep(0.5)

    print("[done    ] timeout — may still be in transit")

if __name__ == "__main__":
    main()
