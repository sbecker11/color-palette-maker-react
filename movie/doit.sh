#!/bin/zsh

OPEN_IMMEDIATELY=1

# activate venv, create and install if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating venv..."
    python3 -m venv venv
    source venv/bin/activate
    pip install opencv-python numpy
else
    source venv/bin/activate
fi

# the input file
input_file=recording.mov

# the timestamp
dt=$(date +%Y-%m-%d_%H-%M-%S)

# the timestamped output file
output_file="output-${dt}.mp4"

# the timestamped script for this output file
script_file="script-${dt}.json"
cp camera-script.json $script_file

# apply the script to the input file and create the output file
# --srt to also output the subtitle file
python3 camera_apply.py ${input_file} ${script_file} ${output_file} --srt

# view and archive if output was created, otherwise report failure
if [ -f "${output_file}" ]; then
    archive_dir="archive"
    mkdir -p $archive_dir
    mv $script_file $archive_dir
    mv $output_file $archive_dir
    mv output-${dt}.srt $archive_dir

    if [ -n "$OPEN_IMMEDIATELY" ]; then
        open ${archive_dir}/${output_file}
    fi
else
    echo "ERROR: ${output_file} was not created"
fi
