#!/bin/bash
chmod +x /home/quan/quanlythucphamchay/app.py
sudo cp /home/quan/quanlythucphamchay/scripts/qltp.service /etc/systemd/system/qltp.service
sudo systemctl daemon-reload
sudo systemctl enable qltp.service
sudo systemctl start qltp.service
sudo service qltp status