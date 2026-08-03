#!/bin/bash
cd /home/kuruma/thermo
nohup .venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port 8100 >> logs/uvicorn.log 2>&1 &
