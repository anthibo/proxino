from proxino.netinfo import lan_ips

def test_lan_ips_returns_list_without_loopback():
    ips = lan_ips()
    assert isinstance(ips, list)
    assert all(ip.count(".") == 3 for ip in ips)
    assert "127.0.0.1" not in ips
