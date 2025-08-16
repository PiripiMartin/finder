#!/bin/bash
echo 'run after_install.sh: ' >> /home/ec2-user/myrepo/deploy.log

echo 'cd /home/ec2-user/finder/api' >> /home/ec2-user/myrepo/deploy.log
cd /home/ec2-user/finder/api >> /home/ec2-user/myrepo/deploy.log

echo 'bun install' >> /home/ec2-user/myrepo/deploy.log 
bun install >> /home/ec2-user/myrepo/deploy.log
